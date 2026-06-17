# bookings/serializers.py
from rest_framework import serializers
from .models import Route, Trip, Bus, Booking
from payments.models import Payment

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ['id', 'name', 'origin', 'destination']


class BusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bus
        fields = ['id', 'plate_number', 'capacity', 'vehicle_type', 'driver_name', 'is_active']


class TripSerializer(serializers.ModelSerializer):
    route = RouteSerializer(read_only=True)
    bus = BusSerializer(read_only=True)
    available_seats = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = ['id', 'route', 'bus', 'departure_time', 'arrival_time', 'fare', 'date', 'available_seats']

    def get_available_seats(self, obj):
        booked_seats = Booking.objects.filter(trip=obj, status='confirmed').values_list('seat_number', flat=True)
        all_seats = obj.get_seat_layout()
        available = [seat for seat in all_seats if seat not in booked_seats]
        return {
            'total': len(all_seats),
            'booked': len(booked_seats),
            'available': len(available),
            'list': available,   # optional, may be large
        }


class BookingCreateSerializer(serializers.ModelSerializer):
    seat_number = serializers.CharField(required=False, allow_blank=True)
    seat_numbers = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=False,
        write_only=True,
    )

    class Meta:
        model = Booking
        fields = ['trip', 'passenger_name', 'phone_number', 'seat_number', 'seat_numbers']
        validators = []

    def validate(self, data):
        if not data.get('seat_number') and not self.initial_data.get('seat_numbers'):
            raise serializers.ValidationError({"seat_number": "Select at least one seat"})
        return data

    def validate_seat_number(self, value):
        trip = self.initial_data.get('trip')
        if not trip:
            raise serializers.ValidationError("Trip is required")
        # trip might be passed as ID, so we need to fetch it
        return value


class BookingDetailSerializer(serializers.ModelSerializer):
    trip = TripSerializer(read_only=True)
    payment_status = serializers.SerializerMethodField()
    mpesa_receipt = serializers.SerializerMethodField()
    ticket_download_url = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ['id', 'reference', 'passenger_name', 'phone_number', 'seat_number', 'status', 'created_at', 'trip', 'payment_status', 'mpesa_receipt', 'qr_code', 'ticket_download_url']

    def get_payment_status(self, obj):
        try:
            payment = Payment.objects.get(booking=obj)
            return payment.status
        except Payment.DoesNotExist:
            return None

    def get_mpesa_receipt(self, obj):
        try:
            payment = Payment.objects.get(booking=obj)
            return payment.mpesa_receipt
        except Payment.DoesNotExist:
            return None

    def get_ticket_download_url(self, obj):
        request = self.context.get('request')
        if not request or obj.status != 'confirmed':
            return None
        return request.build_absolute_uri(f'/api/bookings/{obj.id}/ticket/')
