from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

from bookings.models import Booking
from .models import Payment
from payments.sms import send_sms

import qrcode
from io import BytesIO
from django.core.files import File

@csrf_exempt
def mpesa_callback(request):
    print("🔥 CALLBACK HIT")

    data = json.loads(request.body)
    print("CALLBACK DATA:", data)

    try:
        stk = data['Body']['stkCallback']
        checkout_id = stk['CheckoutRequestID']
        result_code = stk['ResultCode']

        payment = Payment.objects.get(
            checkout_request_id=checkout_id
        )

        booking = payment.booking

        # ---------------------------
        # SUCCESS PAYMENT
        # ---------------------------
        if result_code == 0:

            # extract M-Pesa receipt safely
            receipt = ""
            for item in stk.get("CallbackMetadata", {}).get("Item", []):
                if item.get("Name") == "MpesaReceiptNumber":
                    receipt = item.get("Value")
                    break

            # update payment
            payment.status = "SUCCESS"
            payment.mpesa_receipt = receipt
            payment.save()

            group_bookings = Booking.objects.filter(payment_group=booking.payment_group) if booking.payment_group else Booking.objects.filter(id=booking.id)
            seats = []
            references = []

            for item_booking in group_bookings:
                item_booking.status = "confirmed"

                if not item_booking.reference:
                    item_booking.reference = f"MTT-{item_booking.id:06d}"

                item_booking.save()
                seats.append(item_booking.seat_number)
                references.append(item_booking.reference)

                qr_data = f"{item_booking.reference} | {item_booking.trip.route.name} | Seat {item_booking.seat_number}"
                qr_img = qrcode.make(qr_data)
                buffer = BytesIO()
                qr_img.save(buffer, format="PNG")
                buffer.seek(0)
                file_name = f"{item_booking.reference}.png"
                item_booking.qr_code.save(file_name, File(buffer), save=True)


            # SMS MESSAGE
            message = (
                f"Payment Successful!\n"
                f"Route: {booking.trip.route.name}\n"
                f"Seats: {', '.join(seats)}\n"
                f"Reference: {', '.join(references)}\n"
                f"Receipt: {receipt}"
            )

            try:
                response = send_sms(payment.phone, message)
                print("📩 SMS RESPONSE:", response)
            except Exception as e:
                print("❌ SMS FAILED:", str(e))

            

            print("💰 PAYMENT SUCCESS")

        # ---------------------------
        # FAILED PAYMENT
        # ---------------------------
        
        else:
            payment.status = "FAILED"
            payment.save()

            booking = payment.booking
            group_bookings = Booking.objects.filter(payment_group=booking.payment_group) if booking.payment_group else Booking.objects.filter(id=booking.id)
            group_bookings.update(status="payment_failed")

            print(f"❌ PAYMENT FAILED: {stk.get('ResultDesc')}")

            

    except Exception as e:
        print("ERROR:", str(e))

    return JsonResponse({
        "ResultCode": 0,
        "ResultDesc": "Accepted"
    })
