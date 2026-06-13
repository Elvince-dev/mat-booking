# bookings/models.py
from django.db import models
import uuid

class Route(models.Model):
    name = models.CharField(max_length=100)
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.origin} → {self.destination}"


class Bus(models.Model):
    VEHICLE_TYPES = [
        ('matatu', 'Matatu (14 seater)'),
        ('minibus', 'Mini-bus (33 seater)'),
        ('coach', 'Coach (51 seater)'),
    ]
    plate_number = models.CharField(max_length=20)
    capacity = models.IntegerField()
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPES, default='matatu')
    driver_name = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.plate_number} ({self.get_vehicle_type_display()})"


class Trip(models.Model):
    """
    Represents a scheduled departure of a bus on a specific route.
    """
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='trips')
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name='trips')
    departure_time = models.TimeField()
    arrival_time = models.TimeField()
    fare = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()   # could be expanded to a date range, but for now daily schedule

    class Meta:
        unique_together = ('route', 'bus', 'departure_time', 'date')

    def __str__(self):
        return f"{self.route} - {self.departure_time} ({self.bus.plate_number})"

    def get_seat_layout(self):
        """Return a list of seat labels based on bus type."""
        if self.bus.vehicle_type == 'matatu':
            # 14 seats: rows 1-4 with A,B,C (but C is only in rows 1-4, B1,B2 for back)
            seats = []
            for row in range(1, 5):
                seats.append(f"{row}A")
                seats.append(f"{row}B")
                seats.append(f"{row}C")
            seats.append("B1")
            seats.append("B2")
            return seats
        elif self.bus.vehicle_type == 'minibus':
            # 33 seats: rows 1-8, each row A,B,C,D; plus back row B1..B4
            seats = []
            for row in range(1, 9):
                for col in ['A','B','C','D']:
                    seats.append(f"{row}{col}")
            for i in range(1,5):
                seats.append(f"B{i}")
            return seats[:self.bus.capacity]  # trim to actual capacity
        else:  # coach 51 seater: rows 1-11, A,B,C,D,E? For simplicity, we'll use numbers 1-51
            return [str(i) for i in range(1, self.bus.capacity+1)]


class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('confirmed', 'Confirmed'),
        ('payment_failed', 'Payment Failed'),
        ('cancelled', 'Cancelled'),
    ]
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='bookings')
    passenger_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=15)
    seat_number = models.CharField(max_length=10)   # now string, e.g., "3A"
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_payment')
    created_at = models.DateTimeField(auto_now_add=True)
    reference = models.CharField(max_length=20, unique=True, blank=True, null=True)
    payment_group = models.CharField(max_length=40, blank=True, null=True, db_index=True)
    qr_code = models.ImageField(upload_to="qr_codes/", blank=True, null=True)

    def __str__(self):
        return f"{self.passenger_name} - Seat {self.seat_number} ({self.trip})"
