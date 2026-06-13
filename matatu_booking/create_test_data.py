#!/usr/bin/env python
"""Create test data for Njoroline booking system"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'matatu_booking.settings')
django.setup()

from bookings.models import Route, Bus, Trip
from datetime import date
import datetime

# Create a route
route, created = Route.objects.get_or_create(
    name="Nakuru - Kisumu",
    defaults={"origin": "Nakuru", "destination": "Kisumu"}
)
print(f"✅ Route: {route} (created={created})")

# Create a bus
bus, created = Bus.objects.get_or_create(
    plate_number="KCA-800X",
    defaults={
        "capacity": 14,
        "vehicle_type": "matatu",
        "driver_name": "Peter Kipchoge",
        "is_active": True
    }
)
print(f"✅ Bus: {bus} (created={created})")

# Create trips for today
today = date.today()

trip1, created = Trip.objects.get_or_create(
    route=route,
    bus=bus,
    date=today,
    departure_time=datetime.time(7, 0),
    defaults={
        "arrival_time": datetime.time(10, 0),
        "fare": 150.00
    }
)
print(f"✅ Trip 1: {trip1} at {trip1.departure_time} (created={created})")

trip2, created = Trip.objects.get_or_create(
    route=route,
    bus=bus,
    date=today,
    departure_time=datetime.time(14, 0),
    defaults={
        "arrival_time": datetime.time(17, 0),
        "fare": 150.00
    }
)
print(f"✅ Trip 2: {trip2} at {trip2.departure_time} (created={created})")

print("\n✨ Test data created successfully!")
