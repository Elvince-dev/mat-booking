# bookings/api_views.py
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db import IntegrityError
from django.http import HttpResponse
from .models import Route, Trip, Bus, Booking
from .serializers import RouteSerializer, TripSerializer, BookingCreateSerializer, BookingDetailSerializer
from payments.mpesa import MpesaRequestError, stk_push
from payments.models import Payment
from payments.services import confirm_payment_and_send_sms
from payments.sms import send_sms, sms_was_successful
import json
import uuid


class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return


def generate_booking_reference():
    """Generate a unique booking reference."""
    import uuid
    return f"MTT-{uuid.uuid4().hex[:8].upper()}"

@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def route_list(request):
    """
    GET /api/routes/?date=2026-06-10
    Returns all routes with their trips for the given date (or today if not provided).
    """
    date = request.query_params.get('date')
    if not date:
        from datetime import date as today_date
        date = today_date.today().isoformat()

    routes = Route.objects.prefetch_related('trips').all()
    data = []
    for route in routes:
        trips = route.trips.filter(date=date)
        data.append({
            'id': route.id,
            'name': route.name,
            'origin': route.origin,
            'destination': route.destination,
            'trips': TripSerializer(trips, many=True).data
        })
    return Response(data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def trip_seat_map(request, trip_id):
    """
    GET /api/trips/<id>/seats/
    Returns full seat layout with booked seats marked.
    """
    trip = get_object_or_404(Trip, id=trip_id)
    booked_seats = Booking.objects.filter(trip=trip, status='confirmed').values_list('seat_number', flat=True)
    all_seats = trip.get_seat_layout()
    seat_map = []
    for seat in all_seats:
        seat_map.append({
            'label': seat,
            'is_booked': seat in booked_seats,
        })
    return Response({
        'trip_id': trip.id,
        'bus_type': trip.bus.vehicle_type,
        'capacity': trip.bus.capacity,
        'fare': trip.fare,
        'departure_time': trip.departure_time,
        'seat_map': seat_map,
    })


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def create_booking(request):
    """
    POST /api/bookings/
    Body: { "trip": 1, "passenger_name": "John", "phone_number": "0712345678", "seat_numbers": ["3A", "3B"] }
    Creates booking, triggers STK push, returns booking ID and checkout_request_id.
    """
    validation_data = request.data.copy()
    if not validation_data.get('seat_number'):
        validation_seats = validation_data.get('seat_numbers') or validation_data.get('seats') or []
        if isinstance(validation_seats, list) and validation_seats:
            validation_data['seat_number'] = validation_seats[0]

    serializer = BookingCreateSerializer(data=validation_data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    trip_id = request.data.get('trip')
    requested_seats = request.data.get('seat_numbers') or request.data.get('seats')
    if requested_seats is None:
        requested_seats = [request.data.get('seat_number')]
    if isinstance(requested_seats, str):
        requested_seats = [requested_seats]

    seat_numbers = []
    for seat in requested_seats:
        seat = str(seat or '').strip()
        if seat and seat not in seat_numbers:
            seat_numbers.append(seat)

    passenger_name = request.data.get('passenger_name')
    phone = request.data.get('phone_number')
    user = request.user if request.user.is_authenticated else None

    trip = get_object_or_404(Trip, id=trip_id)

    if not seat_numbers:
        return Response({'error': 'Select at least one seat'}, status=status.HTTP_400_BAD_REQUEST)

    invalid_seats = [seat for seat in seat_numbers if seat not in trip.get_seat_layout()]
    if invalid_seats:
        return Response({'error': f"Invalid seat selection: {', '.join(invalid_seats)}"}, status=status.HTTP_400_BAD_REQUEST)

    # Only confirmed bookings occupy seats. Pending bookings wait for payment.
    taken_seats = list(
        Booking.objects.filter(
            trip=trip,
            seat_number__in=seat_numbers,
            status='confirmed',
        ).values_list('seat_number', flat=True)
    )
    if taken_seats:
        return Response({'error': f"Seat already taken: {', '.join(taken_seats)}"}, status=status.HTTP_409_CONFLICT)

    try:
        with transaction.atomic():
            payment_group = uuid.uuid4().hex
            bookings = [
                Booking.objects.create(
                    trip=trip,
                    user=user,
                    passenger_name=passenger_name,
                    phone_number=phone,
                    seat_number=seat_number,
                    status='pending_payment',
                    reference=generate_booking_reference(),
                    payment_group=payment_group,
                )
                for seat_number in seat_numbers
            ]
            booking = bookings[0]
    except IntegrityError:
        return Response({'error': 'One of those seats was taken just now. Try again.'}, status=status.HTTP_409_CONFLICT)

    payment_method = request.data.get('payment_method') or 'mpesa_direct'
    amount = float(trip.fare) * len(seat_numbers)

    if payment_method == 'mpesa_sms':
        booking_references = [item.reference for item in bookings]
        account_number = f"{settings.MPESA_ACCOUNT_PREFIX}-{booking.reference or booking.id}"
        Payment.objects.create(
            booking=booking,
            phone=phone,
            amount=amount,
            checkout_request_id=f"SMS-{booking.payment_group or booking.id}",
            merchant_request_id=account_number,
            status='PENDING'
        )
        message = (
            f"Njoroline payment instructions:\n"
            f"PayBill: {settings.MPESA_PAYBILL_NUMBER}\n"
            f"Account: {account_number}\n"
            f"Amount: KES {int(amount) if amount.is_integer() else amount}\n"
            f"Route: {trip.route}\n"
            f"Seat(s): {', '.join(seat_numbers)}\n"
            f"Ref: {', '.join(booking_references)}"
        )
        sms_response = send_sms(phone, message)
        sms_sent = sms_was_successful(sms_response) 

        return Response({
            'booking_id': booking.id,
            'booking_ids': [item.id for item in bookings],
            'seat_numbers': seat_numbers,
            'total_amount': amount,
            'checkout_request_id': None,
            'payment_method': 'mpesa_sms',
            'paybill': settings.MPESA_PAYBILL_NUMBER,
            'account_number': account_number,
            'sms_sent': sms_sent,
            'message': 'Payment instructions sent by SMS.' if sms_sent else 'Booking created. SMS could not be sent, so show these payment instructions to the passenger.'
        }, status=status.HTTP_201_CREATED)

    if payment_method != 'mpesa_direct':
        Booking.objects.filter(payment_group=booking.payment_group).update(status='payment_failed')
        return Response({'error': 'Unsupported payment method'}, status=status.HTTP_400_BAD_REQUEST)

    # Trigger M-Pesa STK push
    try:
        mpesa_response = stk_push(phone, amount)
        print("MPESA RESPONSE:", mpesa_response)

        if mpesa_response.get("ResponseCode") != "0":
            Booking.objects.filter(payment_group=booking.payment_group).update(status='payment_failed')
            print("MPESA REQUEST FAILED:", mpesa_response)
            return Response({'error': 'M-Pesa request failed', 'details': mpesa_response}, status=status.HTTP_400_BAD_REQUEST)

        checkout_id = mpesa_response.get("CheckoutRequestID")
        merchant_id = mpesa_response.get("MerchantRequestID")
        if not checkout_id:
            Booking.objects.filter(payment_group=booking.payment_group).update(status='payment_failed')
            return Response({'error': 'Invalid M-Pesa response'}, status=status.HTTP_400_BAD_REQUEST)

        # Create Payment record
        Payment.objects.create(
            booking=booking,
            phone=phone,
            amount=amount,
            checkout_request_id=checkout_id,
            merchant_request_id=merchant_id,
            status='PENDING'
        )

        return Response({
            'booking_id': booking.id,
            'booking_ids': [item.id for item in bookings],
            'seat_numbers': seat_numbers,
            'total_amount': amount,
            'checkout_request_id': checkout_id,
            'message': 'STK push sent. Complete payment on your phone.'
        }, status=status.HTTP_201_CREATED)

    except MpesaRequestError as e:
        Booking.objects.filter(payment_group=booking.payment_group).update(status='payment_failed')
        return Response(
            {
                'error': str(e),
                'details': 'The booking was not confirmed. Please retry payment after checking your internet connection or Safaricom sandbox status.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as e:
        Booking.objects.filter(payment_group=booking.payment_group).update(status='payment_failed')
        return Response({'error': f'Failed to initiate payment: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def booking_status(request, booking_id):
    """
    GET /api/bookings/<id>/status/
    Returns current booking and payment status.
    """
    booking = get_object_or_404(Booking, id=booking_id)
    serializer = BookingDetailSerializer(booking, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def download_booking_ticket(request, booking_id):
    booking = get_object_or_404(
        Booking.objects.select_related('trip__route', 'trip__bus'),
        id=booking_id,
    )

    if booking.status != 'confirmed':
        return Response({'error': 'Ticket is available after booking confirmation.'}, status=status.HTTP_400_BAD_REQUEST)

    group_bookings = (
        Booking.objects.filter(payment_group=booking.payment_group)
        if booking.payment_group
        else Booking.objects.filter(id=booking.id)
    ).select_related('trip__route', 'trip__bus').order_by('id')

    payment = Payment.objects.filter(
        booking__in=group_bookings,
        status='SUCCESS',
    ).order_by('-created_at').first()

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

    response = HttpResponse(content_type='application/pdf')
    reference = booking.reference or f'MTT-{booking.id:06d}'
    response['Content-Disposition'] = f'attachment; filename="{reference}-ticket.pdf"'

    pdf = SimpleDocTemplate(response, pagesize=A4, title=f'Njoroline Ticket {reference}')
    styles = getSampleStyleSheet()
    seats = ', '.join(item.seat_number for item in group_bookings)
    references = ', '.join(item.reference or f'MTT-{item.id:06d}' for item in group_bookings)
    trip = booking.trip

    elements = [
        Paragraph('NJOROLINE E-TICKET', styles['Title']),
        Spacer(1, 16),
        Paragraph(f'<b>Passenger:</b> {booking.passenger_name}', styles['Normal']),
        Paragraph(f'<b>Route:</b> {trip.route}', styles['Normal']),
        Paragraph(f'<b>Vehicle:</b> {trip.bus.plate_number}', styles['Normal']),
        Paragraph(f'<b>Date:</b> {trip.date.strftime("%d %b %Y")}', styles['Normal']),
        Paragraph(f'<b>Departure:</b> {trip.departure_time.strftime("%I:%M %p")}', styles['Normal']),
        Paragraph(f'<b>Arrival:</b> {trip.arrival_time.strftime("%I:%M %p")}', styles['Normal']),
        Paragraph(f'<b>Seat(s):</b> {seats}', styles['Normal']),
        Paragraph(f'<b>Reference:</b> {references}', styles['Normal']),
        Paragraph(f'<b>Status:</b> Confirmed', styles['Normal']),
    ]

    if payment:
        elements.extend([
            Paragraph(f'<b>M-Pesa Receipt:</b> {payment.mpesa_receipt or "-"}', styles['Normal']),
            Paragraph(f'<b>Paid:</b> KES {payment.amount}', styles['Normal']),
        ])

    elements.append(Spacer(1, 20))

    if booking.qr_code:
        elements.append(Image(booking.qr_code.path, width=150, height=150))
        elements.append(Spacer(1, 12))

    elements.append(Paragraph('Show this ticket or QR code when boarding.', styles['Italic']))
    pdf.build(elements)

    return response


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def user_bookings(request):
    bookings = (
        Booking.objects
        .filter(user=request.user)
        .select_related('trip__route', 'trip__bus')
        .prefetch_related('payment_set')
        .order_by('-created_at')
    )

    return Response([
        {
            'id': booking.id,
            'reference': booking.reference,
            'passenger_name': booking.passenger_name,
            'phone_number': booking.phone_number,
            'route': str(booking.trip.route),
            'origin': booking.trip.route.origin,
            'destination': booking.trip.route.destination,
            'vehicle': booking.trip.bus.plate_number,
            'trip_date': booking.trip.date,
            'departure_time': booking.trip.departure_time,
            'arrival_time': booking.trip.arrival_time,
            'seat_number': booking.seat_number,
            'fare': booking.trip.fare,
            'status': booking.status,
            'payment_status': booking.payment_set.first().status if booking.payment_set.exists() else None,
            'mpesa_receipt': booking.payment_set.first().mpesa_receipt if booking.payment_set.exists() else None,
            'created_at': booking.created_at,
            'qr_code': request.build_absolute_uri(booking.qr_code.url) if booking.qr_code else None,
        }
        for booking in bookings
    ])


@api_view(['GET'])
@permission_classes([IsAdminUser])   # only logged-in admin users
def admin_stats(request):
    """
    GET /api/admin/stats/
    Returns aggregated stats for the admin dashboard.
    """
    from django.db.models import Sum, Count
    from datetime import datetime, timedelta
    from django.utils import timezone
    from payments.models import Payment

    total_bookings = Booking.objects.count()
    confirmed_bookings = Booking.objects.filter(status='confirmed').count()
    failed_bookings = Booking.objects.filter(status='payment_failed').count()
    revenue = Payment.objects.filter(status='SUCCESS').aggregate(total=Sum('amount'))['total'] or 0
    today = timezone.now().date()
    today_revenue = Payment.objects.filter(status='SUCCESS', created_at__date=today).aggregate(total=Sum('amount'))['total'] or 0
    week_revenue = Payment.objects.filter(status='SUCCESS', created_at__gte=timezone.now() - timedelta(days=7)).aggregate(total=Sum('amount'))['total'] or 0
    recent_bookings = Booking.objects.order_by('-id')[:10].select_related('trip__route', 'trip__bus').prefetch_related('payment_set')

    recent_data = []
    for b in recent_bookings:
        recent_data.append({
            'id': b.id,
            'reference': b.reference,
            'passenger_name': b.passenger_name,
            'phone_number': b.phone_number,
            'route': str(b.trip.route),
            'seat_number': b.seat_number,
            'fare': b.trip.fare,
            'status': b.status,
            'payment_status': b.payment_set.first().status if b.payment_set.exists() else None,
            'created_at': b.created_at,
        })

    return Response({
        'total_bookings': total_bookings,
        'confirmed_bookings': confirmed_bookings,
        'failed_bookings': failed_bookings,
        'revenue': revenue,
        'today_revenue': today_revenue,
        'week_revenue': week_revenue,
        'recent_bookings': recent_data,
    })


@api_view(['GET'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_portal_data(request):
    from django.contrib.auth.models import User
    from django.db.models import Count

    buses = Bus.objects.order_by('plate_number')
    routes = Route.objects.order_by('origin', 'destination')
    trips = Trip.objects.select_related('route', 'bus').order_by('-date', 'departure_time')
    bookings = Booking.objects.select_related('trip__route', 'trip__bus').prefetch_related('payment_set').order_by('-created_at')
    payments = Payment.objects.select_related('booking__trip__route').order_by('-created_at')
    users = User.objects.order_by('-date_joined')

    passenger_rows = {}
    for booking in bookings:
        key = booking.phone_number
        passenger_rows.setdefault(key, {
            'name': booking.passenger_name,
            'phone_number': booking.phone_number,
            'bookings': 0,
            'confirmed_bookings': 0,
            'last_booking_at': booking.created_at,
        })
        passenger_rows[key]['bookings'] += 1
        if booking.status == 'confirmed':
            passenger_rows[key]['confirmed_bookings'] += 1

    return Response({
        'buses': [
            {
                'id': bus.id,
                'plate_number': bus.plate_number,
                'capacity': bus.capacity,
                'vehicle_type': bus.vehicle_type,
                'driver_name': bus.driver_name,
                'is_active': bus.is_active,
                'trips_count': bus.trips.count(),
            }
            for bus in buses
        ],
        'routes': [
            {
                'id': route.id,
                'name': route.name,
                'origin': route.origin,
                'destination': route.destination,
                'trips_count': route.trips.count(),
                'bookings_count': Booking.objects.filter(trip__route=route).count(),
            }
            for route in routes
        ],
        'trips': [
            {
                'id': trip.id,
                'route_id': trip.route_id,
                'route': str(trip.route),
                'bus_id': trip.bus_id,
                'bus': trip.bus.plate_number,
                'driver_name': trip.bus.driver_name,
                'date': trip.date,
                'departure_time': trip.departure_time,
                'arrival_time': trip.arrival_time,
                'fare': trip.fare,
                'capacity': trip.bus.capacity,
                'booked_seats': trip.bookings.filter(status='confirmed').count(),
                'confirmed_seats': trip.bookings.filter(status='confirmed').count(),
            }
            for trip in trips
        ],
        'bookings': [
            {
                'id': booking.id,
                'reference': booking.reference,
                'passenger_name': booking.passenger_name,
                'phone_number': booking.phone_number,
                'route': str(booking.trip.route),
                'vehicle': booking.trip.bus.plate_number,
                'trip_date': booking.trip.date,
                'departure_time': booking.trip.departure_time,
                'seat_number': booking.seat_number,
                'fare': booking.trip.fare,
                'status': booking.status,
                'payment_status': booking.payment_set.first().status if booking.payment_set.exists() else None,
                'mpesa_receipt': booking.payment_set.first().mpesa_receipt if booking.payment_set.exists() else None,
                'created_at': booking.created_at,
                'qr_code': request.build_absolute_uri(booking.qr_code.url) if booking.qr_code else None,
            }
            for booking in bookings[:200]
        ],
        'payments': [
            {
                'id': payment.id,
                'checkout_request_id': payment.checkout_request_id,
                'merchant_request_id': payment.merchant_request_id,
                'booking_id': payment.booking_id,
                'booking_reference': payment.booking.reference,
                'passenger_name': payment.booking.passenger_name,
                'phone': payment.phone,
                'amount': payment.amount,
                'status': payment.status,
                'mpesa_receipt': payment.mpesa_receipt,
                'created_at': payment.created_at,
            }
            for payment in payments[:200]
        ],
        'passengers': list(passenger_rows.values()),
        'registered_users': [
            {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined,
            }
            for user in users[:200]
        ],
    })


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_create_bus(request):
    bus = Bus.objects.create(
        plate_number=request.data.get('plate_number', '').strip(),
        capacity=request.data.get('capacity') or 14,
        vehicle_type=request.data.get('vehicle_type') or 'matatu',
        driver_name=request.data.get('driver_name') or '',
        is_active=bool(request.data.get('is_active', True)),
    )
    return Response({'id': bus.id}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_update_bus(request, bus_id):
    bus = get_object_or_404(Bus, id=bus_id)
    for field in ['plate_number', 'vehicle_type', 'driver_name']:
        if field in request.data:
            setattr(bus, field, request.data.get(field))
    if 'capacity' in request.data:
        bus.capacity = request.data.get('capacity')
    if 'is_active' in request.data:
        bus.is_active = bool(request.data.get('is_active'))
    bus.save()
    return Response({'message': 'Vehicle updated', 'id': bus.id})


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_create_route(request):
    origin = request.data.get('origin', '').strip()
    destination = request.data.get('destination', '').strip()
    name = request.data.get('name', '').strip() or f"{origin} → {destination}"
    route = Route.objects.create(name=name, origin=origin, destination=destination)
    return Response({'id': route.id}, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_update_route(request, route_id):
    route = get_object_or_404(Route, id=route_id)
    if request.method == 'DELETE':
        route.delete()
        return Response({'message': 'Route deleted', 'id': route_id})
    if 'origin' in request.data:
        route.origin = request.data.get('origin', '').strip()
    if 'destination' in request.data:
        route.destination = request.data.get('destination', '').strip()
    route.name = request.data.get('name', '').strip() or f"{route.origin} → {route.destination}"
    route.save()
    return Response({'message': 'Route updated', 'id': route.id})


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_create_trip(request):
    trip = Trip.objects.create(
        route_id=request.data.get('route_id'),
        bus_id=request.data.get('bus_id'),
        date=request.data.get('date'),
        departure_time=request.data.get('departure_time'),
        arrival_time=request.data.get('arrival_time'),
        fare=request.data.get('fare'),
    )
    return Response({'id': trip.id}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_update_trip(request, trip_id):
    trip = get_object_or_404(Trip, id=trip_id)
    for field in ['route_id', 'bus_id', 'date', 'departure_time', 'arrival_time', 'fare']:
        if field in request.data:
            setattr(trip, field, request.data.get(field))
    try:
        trip.save()
    except IntegrityError:
        return Response({'error': 'A trip with the same route, vehicle, date, and departure time already exists.'}, status=status.HTTP_409_CONFLICT)
    return Response({'message': 'Trip updated', 'id': trip.id})


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAdminUser])
def admin_booking_action(request, booking_id):
    booking = get_object_or_404(Booking, id=booking_id)
    action = request.data.get('action')
    if action == 'cancel':
        booking.status = 'cancelled'
        booking.save()
        return Response({'message': 'Booking updated', 'status': booking.status})
    elif action == 'confirm':
        receipt = (
            request.data.get('receipt')
            or request.data.get('mpesa_receipt')
            or request.data.get('transaction_id')
            or ''
        )
        payment_query = Payment.objects.filter(booking=booking)
        if booking.payment_group:
            payment_query = Payment.objects.filter(booking__payment_group=booking.payment_group)
        payment = payment_query.order_by('-created_at').first()
        if not payment:
            booking.status = 'confirmed'
            booking.save()
            return Response({
                'message': 'Booking updated. No payment record was found, so no confirmation SMS was sent.',
                'status': booking.status,
                'sms_sent': False,
            })

        if payment.checkout_request_id.startswith('SMS-') and not (receipt or payment.mpesa_receipt):
            return Response({
                'error': 'mpesa_receipt is required when manually confirming an M-Pesa SMS booking.'
            }, status=status.HTTP_400_BAD_REQUEST)

        result = confirm_payment_and_send_sms(payment=payment, receipt=receipt)
        if result.get('conflicts'):
            return Response({
                'error': f"Seat already taken: {', '.join(result['conflicts'])}",
                'status': 'payment_failed',
            }, status=status.HTTP_409_CONFLICT)

        return Response({
            'message': 'Booking confirmed',
            'status': 'confirmed',
            'payment_status': 'SUCCESS',
            'mpesa_receipt': result.get('receipt'),
            'sms_sent': result.get('sms_sent', False),
            'sms_duplicate_skipped': result.get('duplicate', False),
        })
    else:
        return Response({'error': 'Unsupported action'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def payment_status_check(request):
    """
    GET /api/payment-status/?checkout_request_id=xxx
    Returns the payment status for a given checkout request ID.
    Allows frontend to poll for payment status without blocking.
    """
    checkout_request_id = request.query_params.get('checkout_request_id')
    if not checkout_request_id:
        return Response({'error': 'checkout_request_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        payment = Payment.objects.get(checkout_request_id=checkout_request_id)
        booking = payment.booking
        group_bookings = Booking.objects.filter(payment_group=booking.payment_group) if booking.payment_group else Booking.objects.filter(id=booking.id)
        seat_numbers = list(group_bookings.values_list('seat_number', flat=True))
        qr_codes = [
            request.build_absolute_uri(item.qr_code.url)
            for item in group_bookings
            if item.qr_code
        ]
        
        return Response({
            'payment_status': payment.status,
            'booking_status': booking.status,
            'booking_id': booking.id,
            'booking_reference': booking.reference,
            'seat_numbers': seat_numbers,
            'qr_code': qr_codes[0] if qr_codes else None,
            'qr_codes': qr_codes,
            'mpesa_receipt': payment.mpesa_receipt,
            'ticket_download_url': request.build_absolute_uri(f'/api/bookings/{booking.id}/ticket/') if booking.status == 'confirmed' else None,
        }, status=status.HTTP_200_OK)
    
    except Payment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
