import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from bookings.models import Booking
from payments.services import confirm_payment_and_send_sms
from .models import Payment


def _mpesa_success_response():
    return JsonResponse({
        "ResultCode": 0,
        "ResultDesc": "Accepted",
    })


def _mpesa_reject_response(message):
    return JsonResponse({
        "ResultCode": 1,
        "ResultDesc": message,
    })


def _get_payload(request):
    if request.body:
        return json.loads(request.body)
    return request.POST.dict()


def _extract_stk_receipt(stk):
    for item in stk.get("CallbackMetadata", {}).get("Item", []):
        if item.get("Name") == "MpesaReceiptNumber":
            return item.get("Value") or ""
    return ""


def _find_sms_payment_by_account(account_number):
    account_number = str(account_number or "").strip()
    if not account_number:
        return None

    payment = Payment.objects.filter(
        merchant_request_id__iexact=account_number,
        checkout_request_id__startswith="SMS-",
    ).order_by("-created_at").first()
    if payment:
        return payment

    reference = account_number.rsplit("-", 1)[-1]
    booking = Booking.objects.filter(reference__iexact=reference).first()
    if not booking:
        return None

    group_query = Payment.objects.filter(checkout_request_id__startswith="SMS-")
    if booking.payment_group:
        return group_query.filter(booking__payment_group=booking.payment_group).order_by("-created_at").first()
    return group_query.filter(booking=booking).order_by("-created_at").first()


@csrf_exempt
def mpesa_callback(request):
    print("MPESA STK CALLBACK HIT")

    try:
        data = _get_payload(request)
        print("STK CALLBACK DATA:", data)

        stk = data["Body"]["stkCallback"]
        checkout_id = stk["CheckoutRequestID"]
        result_code = stk["ResultCode"]

        payment = Payment.objects.get(checkout_request_id=checkout_id)

        if result_code == 0:
            result = confirm_payment_and_send_sms(
                payment=payment,
                receipt=_extract_stk_receipt(stk),
            )

            if result.get("conflicts"):
                print("PAYMENT RECEIVED BUT SEAT ALREADY CONFIRMED:", result["conflicts"])
            elif result["duplicate"]:
                print("BOOKING CONFIRMATION SMS SKIPPED: duplicate successful callback")
            elif result["sms_sent"]:
                print("BOOKING CONFIRMATION SMS SENT:", result.get("sms_response"))
            else:
                print("BOOKING CONFIRMATION SMS NOT SENT:", result.get("sms_response"))

            print("PAYMENT SUCCESS")

        else:
            payment.status = "FAILED"
            payment.save()

            booking = payment.booking
            group_bookings = (
                Booking.objects.filter(payment_group=booking.payment_group)
                if booking.payment_group
                else Booking.objects.filter(id=booking.id)
            )
            group_bookings.update(status="payment_failed")

            print(f"PAYMENT FAILED: {stk.get('ResultDesc')}")

    except Exception as exc:
        print("STK CALLBACK ERROR:", str(exc))

    return _mpesa_success_response()


@csrf_exempt
def c2b_validation(request):
    try:
        data = _get_payload(request)
        print("C2B VALIDATION DATA:", data)
        account_number = data.get("BillRefNumber") or data.get("bill_ref_number")
        payment = _find_sms_payment_by_account(account_number)
        if not payment:
            return _mpesa_reject_response("No pending booking matches this account number.")
    except Exception as exc:
        print("C2B VALIDATION ERROR:", str(exc))
        return _mpesa_reject_response("Could not validate payment.")

    return _mpesa_success_response()


@csrf_exempt
def c2b_confirmation(request):
    try:
        data = _get_payload(request)
        print("C2B CONFIRMATION DATA:", data)

        account_number = data.get("BillRefNumber") or data.get("bill_ref_number")
        receipt = data.get("TransID") or data.get("trans_id") or ""
        payment = _find_sms_payment_by_account(account_number)
        if not payment:
            print("C2B CONFIRMATION PAYMENT NOT FOUND:", account_number)
            return _mpesa_success_response()

        result = confirm_payment_and_send_sms(payment=payment, receipt=receipt)

        if result.get("conflicts"):
            print("C2B PAYMENT RECEIVED BUT SEAT ALREADY CONFIRMED:", result["conflicts"])
        elif result["duplicate"]:
            print("C2B SMS SKIPPED: duplicate successful confirmation")
        elif result["sms_sent"]:
            print("C2B BOOKING CONFIRMATION SMS SENT:", result.get("sms_response"))
        else:
            print("C2B BOOKING CONFIRMATION SMS NOT SENT:", result.get("sms_response"))

    except Exception as exc:
        print("C2B CONFIRMATION ERROR:", str(exc))

    return _mpesa_success_response()
