from django.shortcuts import render, get_object_or_404, redirect
from django.db import IntegrityError
from django.contrib import messages
from .models import Route, Booking, Bus
from payments.models import Payment
from payments.mpesa import stk_push
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponse
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image
)
from reportlab.lib import colors


def index(request):
    return render(request, 'index.html')


def create_booking(request, route_id):
    route = get_object_or_404(Route, id=route_id)
    buses = Bus.objects.all()

    bus_id = request.GET.get("bus")
    selected_bus = None
    booked_seats = []

    if bus_id:
        selected_bus = get_object_or_404(Bus, id=bus_id)
        booked_seats = list(
            Booking.objects.filter(
                route=route,
                bus=selected_bus,
                status__in=["pending_payment", "confirmed"]
            ).values_list("seat_number", flat=True)
        )

    if request.method == "POST":
        name = request.POST['name']
        phone = request.POST['phone']
        seat = int(request.POST['seat'])
        bus = get_object_or_404(Bus, id=request.POST['bus'])

        # refresh booked seats (safety check)
        booked_seats = list(
            Booking.objects.filter(
                route=route,
                bus=bus,
                status__in=["pending_payment", "confirmed"]
            ).values_list("seat_number", flat=True)
        )

        # quick UX-level protection
        if seat in booked_seats:
            messages.error(request, "Seat already taken. Choose another one.")
            return redirect(f"/book/{route.id}/?bus={bus.id}")

        # 🧾 create booking safely (DB-level protection included)
        try:
            booking = Booking.objects.create(
                route=route,
                bus=bus,
                passenger_name=name,
                phone_number=phone,
                seat_number=seat,
                status="pending_payment"
            )

        except IntegrityError:
            messages.error(request, "Seat was just taken. Please choose another one.")
            return redirect(f"/book/{route.id}/?bus={bus.id}")

        # 💳 trigger M-Pesa STK push
        try:
            response = stk_push(phone, 1)
            # print("MPESA RESPONSE:")
            # print(response)

            print("MPESA RESPONSE:", response)

            if response.get("ResponseCode") != "0":
                booking.status = "payment_failed"
                booking.save()

                messages.error(
                    request,
                    "M-Pesa request failed. Try again."
                )
                return redirect(f"/book/{route.id}/?bus={bus.id}")

            
            if not checkout_id:
                messages.error(
                    request,
                    f"M-Pesa request failed: {response}"
                )
                return redirect(f"/book/{route.id}/?bus={bus.id}")
        except Exception:
            booking.status = "payment_failed"
            booking.save()
            messages.error(request, "Failed to initiate M-Pesa payment. Try again.")
            return redirect(f"/book/{route.id}/?bus={bus.id}")

        # extract IDs safely
        checkout_id = response.get("CheckoutRequestID", "")
        merchant_id = response.get("MerchantRequestID", "")

        # 💾 save payment record
        Payment.objects.create(
            booking=booking,
            phone=phone,
            amount=1,
            checkout_request_id=checkout_id,
            merchant_request_id=merchant_id,
            status="PENDING"
        )

        messages.success(request, "STK push sent. Complete payment on your phone.")
        # return redirect(f"/book/{route.id}/?bus={bus.id}")
        return redirect("booking_pending", booking_id=booking.id)

    return render(request, "bookings/create_booking.html", {
        "route": route,
        "buses": buses,
        "selected_bus": selected_bus,
        "booked_seats": booked_seats
    })


def ticket_view(request, booking_id):
    booking = get_object_or_404(Booking, id=booking_id)

    return render(request, "bookings/ticket.html", {
        "booking": booking
    })


def route_list(request):
    routes = Route.objects.all()
    return render(request, 'bookings/route_list.html', {'routes': routes})


def get_booked_seats(route, bus):
    bookings = Booking.objects.filter(
        route=route,
        bus=bus,
        status__in=["pending_payment", "confirmed"]
    )
    return list(bookings.values_list("seat_number", flat=True))





def booking_success(request, booking_id):

    booking = get_object_or_404(
        Booking,
        id=booking_id
    )

    payment = Payment.objects.filter(
        booking=booking
    ).first()

    return render(
        request,
        "bookings/booking_success.html",
        {
            "booking": booking,
            "payment": payment
        }
    )


def booking_pending(request, booking_id):

    booking = get_object_or_404(Booking, id=booking_id)

    if booking.status == "confirmed":
        return redirect("booking_success", booking_id=booking.id)

    if booking.status == "payment_failed":
        return render(request, "bookings/payment_failed.html", {
            "booking": booking
        })

    return render(request, "bookings/booking_pending.html", {
        "booking": booking
    })


@login_required
def dashboard(request):

    total_bookings = Booking.objects.count()

    confirmed_bookings = Booking.objects.filter(
        status="confirmed"
    ).count()

    failed_bookings = Booking.objects.filter(
        status="payment_failed"
    ).count()

    revenue = Payment.objects.filter(
        status="SUCCESS"
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    today = timezone.now().date()

    today_revenue = Payment.objects.filter(
        status="SUCCESS",
        created_at__date=today
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    week_revenue = Payment.objects.filter(
        status="SUCCESS",
        created_at__gte=timezone.now() - timedelta(days=7)
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    recent_bookings = Booking.objects.order_by(
        "-id"
    )[:10]

    context = {
        "total_bookings": total_bookings,
        "confirmed_bookings": confirmed_bookings,
        "failed_bookings": failed_bookings,
        "revenue": revenue,
        "today_revenue": today_revenue,
        "week_revenue": week_revenue,
        "recent_bookings": recent_bookings,
    }

    return render(
        request,
        "bookings/dashboard.html",
        context
    )



def download_ticket(request, booking_id):

    booking = get_object_or_404(
        Booking,
        id=booking_id
    )

    payment = Payment.objects.filter(
        booking=booking,
        status="SUCCESS"
    ).first()

    response = HttpResponse(
        content_type="application/pdf"
    )

    response[
        "Content-Disposition"
    ] = (
        f'attachment; filename="{booking.reference}.pdf"'
    )

    pdf = SimpleDocTemplate(response)

    styles = getSampleStyleSheet()

    elements = []

    elements.append(
        Paragraph(
            "MATATU TICKET",
            styles["Title"]
        )
    )

    elements.append(Spacer(1, 20))

    elements.append(
        Paragraph(
            f"<b>Reference:</b> {booking.reference}",
            styles["Normal"]
        )
    )

    elements.append(
        Paragraph(
            f"<b>Passenger:</b> {booking.passenger_name}",
            styles["Normal"]
        )
    )

    elements.append(
        Paragraph(
            f"<b>Route:</b> {booking.route}",
            styles["Normal"]
        )
    )

    elements.append(
        Paragraph(
            f"<b>Seat:</b> {booking.seat_number}",
            styles["Normal"]
        )
    )

    elements.append(
        Paragraph(
            f"<b>Status:</b> {booking.status}",
            styles["Normal"]
        )
    )

    if payment:
        elements.append(
            Paragraph(
                f"<b>M-Pesa Receipt:</b> {payment.merchant_request_id}",
                styles["Normal"]
            )
        )

    elements.append(Spacer(1, 20))

    # QR Code Image
    if booking.qr_code:
        elements.append(
            Image(
                booking.qr_code.path,
                width=150,
                height=150
            )
        )

    elements.append(Spacer(1, 20))

    elements.append(
        Paragraph(
            "Generated by Matatu Booking System",
            styles["Italic"]
        )
    )

    pdf.build(elements)

    return response