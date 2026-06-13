#!/usr/bin/env python
"""Test the complete booking flow via API"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("🚀 NJOROLINE BOOKING FLOW TEST")
print("=" * 60)

# Step 1: Get available routes and trips
print("\n1️⃣ FETCHING AVAILABLE ROUTES AND TRIPS")
print("-" * 60)
response = requests.get(f"{BASE_URL}/api/routes/?date=2026-06-11")
routes = response.json()

if routes:
    for route in routes:
        if route["trips"]:
            print(f"✅ Route: {route['name']}")
            for trip in route["trips"]:
                print(f"   📍 Trip ID {trip['id']}: {trip['departure_time']} - {trip['arrival_time']}")
                print(f"      Fare: KES {trip['fare']} | Available: {trip['available_seats']['available']} seats")
                trip_id = trip['id']
                departure_time = trip['departure_time']

# Step 2: Get seat map for a trip
print("\n2️⃣ FETCHING SEAT MAP")
print("-" * 60)
response = requests.get(f"{BASE_URL}/api/trips/{trip_id}/seats/")
seat_data = response.json()
print(f"✅ Trip {trip_id} seat map:")
print(f"   Bus Type: {seat_data['bus_type']}")
print(f"   Capacity: {seat_data['capacity']}")
print(f"   Fare: KES {seat_data['fare']}")
print(f"   Departure: {seat_data['departure_time']}")
available_seats = [s['label'] for s in seat_data['seat_map'] if not s['is_booked']]
print(f"   Available Seats: {', '.join(available_seats[:5])}...")

# Pick a random available seat
import random
selected_seat = random.choice(available_seats)
print(f"   🎯 Selected seat for booking: {selected_seat}")

# Step 3: Create a booking
print("\n3️⃣ CREATING BOOKING")
print("-" * 60)
booking_data = {
    "trip": trip_id,
    "passenger_name": "Jane Mwangi",
    "phone_number": "254712345678",  # M-Pesa requires international format
    "seat_number": selected_seat
}
print(f"📋 Booking details:")
print(f"   Passenger: {booking_data['passenger_name']}")
print(f"   Phone: {booking_data['phone_number']}")
print(f"   Seat: {booking_data['seat_number']}")

response = requests.post(
    f"{BASE_URL}/api/bookings/",
    json=booking_data,
    headers={"Content-Type": "application/json"}
)

if response.status_code == 201:
    booking_response = response.json()
    booking_id = booking_response['booking_id']
    checkout_request_id = booking_response['checkout_request_id']
    print(f"✅ BOOKING CREATED!")
    print(f"   Booking ID: {booking_id}")
    print(f"   Checkout Request ID: {checkout_request_id}")
    print(f"   Message: {booking_response['message']}")
else:
    print(f"❌ Booking failed: {response.status_code}")
    print(f"   Error: {response.text}")
    exit(1)

# Step 4: Check payment status
print("\n4️⃣ CHECKING PAYMENT STATUS")
print("-" * 60)
time.sleep(1)  # Small delay to allow backend to process

response = requests.get(
    f"{BASE_URL}/api/payment-status/?checkout_request_id={checkout_request_id}"
)

if response.status_code == 200:
    payment_status = response.json()
    print(f"✅ PAYMENT STATUS RETRIEVED!")
    print(f"   Payment Status: {payment_status['payment_status']}")
    print(f"   Booking Status: {payment_status['booking_status']}")
    print(f"   Booking ID: {payment_status['booking_id']}")
    print(f"   Booking Reference: {payment_status['booking_reference']}")
else:
    print(f"❌ Status check failed: {response.status_code}")
    print(f"   Error: {response.text}")

# Step 5: Check booking status
print("\n5️⃣ CHECKING BOOKING STATUS")
print("-" * 60)
response = requests.get(f"{BASE_URL}/api/bookings/{booking_id}/status/")

if response.status_code == 200:
    booking_status = response.json()
    print(f"✅ BOOKING STATUS RETRIEVED!")
    print(f"   Reference: {booking_status['reference']}")
    print(f"   Passenger: {booking_status['passenger_name']}")
    print(f"   Phone: {booking_status['phone_number']}")
    print(f"   Seat: {booking_status['seat_number']}")
    print(f"   Status: {booking_status['status']}")
    print(f"   Trip: {booking_status['trip']['route']['name']}")
    print(f"   Created: {booking_status['created_at']}")
else:
    print(f"❌ Booking status check failed: {response.status_code}")

print("\n" + "=" * 60)
print("✨ FLOW TEST COMPLETED SUCCESSFULLY!")
print("=" * 60)
