from io import BytesIO

import qrcode
from django.core.files import File
from django.db import transaction

from bookings.models import Booking
from payments.models import Payment
from payments.sms import send_sms, sms_was_successful


def format_amount(amount):
    if amount == amount.to_integral_value():
        return str(int(amount))
    return str(amount)


def build_booking_confirmation_message(booking, payment, seats, references, receipt):
    trip = booking.trip
    return (
        "Njoroline booking confirmed.\n"
        f"Passenger: {booking.passenger_name}\n"
        f"Route: {trip.route}\n"
        f"Date: {trip.date.strftime('%d %b %Y')}\n"
        f"Departure: {trip.departure_time.strftime('%I:%M %p')}\n"
        f"Seat(s): {', '.join(seats)}\n"
        f"Ref: {', '.join(references)}\n"
        f"Receipt: {receipt}\n"
        f"Paid: KES {format_amount(payment.amount)}"
    )


def confirm_payment_and_send_sms(payment, receipt=""):
    with transaction.atomic():
        payment = Payment.objects.select_for_update().select_related(
            "booking__trip__route",
            "booking__trip__bus",
        ).get(id=payment.id)
        booking = payment.booking
        should_send_confirmation_sms = payment.status != "SUCCESS"

        group_bookings = (
            Booking.objects.select_for_update().filter(payment_group=booking.payment_group)
            if booking.payment_group
            else Booking.objects.select_for_update().filter(id=booking.id)
        )
        group_bookings = list(group_bookings)
        seat_numbers = [item.seat_number for item in group_bookings]
        booking_ids = [item.id for item in group_bookings]

        conflicts = Booking.objects.select_for_update().filter(
            trip=booking.trip,
            seat_number__in=seat_numbers,
            status="confirmed",
        ).exclude(id__in=booking_ids)

        payment.status = "SUCCESS"
        if receipt:
            payment.mpesa_receipt = receipt
        payment.save()

        if conflicts.exists():
            Booking.objects.filter(id__in=booking_ids).update(status="payment_failed")
            return {
                "confirmed": False,
                "sms_sent": False,
                "duplicate": not should_send_confirmation_sms,
                "conflicts": list(conflicts.values_list("seat_number", flat=True)),
            }

        for item_booking in group_bookings:
            item_booking.status = "confirmed"

            if not item_booking.reference:
                item_booking.reference = f"MTT-{item_booking.id:06d}"

            item_booking.save()

        seats = [item_booking.seat_number for item_booking in group_bookings]
        references = [item_booking.reference for item_booking in group_bookings]
        qr_data = (
            f"Refs: {', '.join(references)} | "
            f"Route: {booking.trip.route.name} | "
            f"Departure: {booking.trip.departure_time.strftime('%I:%M %p')} | "
            f"Seats: {', '.join(seats)} | "
            f"Receipt: {payment.mpesa_receipt or receipt}"
        )

        for item_booking in group_bookings:
            qr_img = qrcode.make(qr_data)
            buffer = BytesIO()
            qr_img.save(buffer, format="PNG")
            buffer.seek(0)
            file_name = f"{item_booking.reference}.png"
            item_booking.qr_code.save(file_name, File(buffer), save=True)

    sms_sent = False
    sms_response = None
    if should_send_confirmation_sms:
        message = build_booking_confirmation_message(
            booking=booking,
            payment=payment,
            seats=seats,
            references=references,
            receipt=payment.mpesa_receipt or receipt,
        )
        sms_response = send_sms(payment.phone, message)
        sms_sent = sms_was_successful(sms_response)

    return {
        "confirmed": True,
        "sms_sent": sms_sent,
        "sms_response": sms_response,
        "duplicate": not should_send_confirmation_sms,
        "seats": seats,
        "references": references,
        "receipt": payment.mpesa_receipt,
    }
