import africastalking
from django.conf import settings
from payments.text import send_hostpinnacle_sms


sms = None
if settings.SMS_BACKEND == "africastalking" and settings.AFRICASTALKING_API_KEY:
    africastalking.initialize(settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_API_KEY)
    sms = africastalking.SMS


def format_phone(phone):
    phone = str(phone).strip()

    if phone.startswith("+"):
        return phone

    if phone.startswith("0"):
        return "+254" + phone[1:]

    if phone.startswith("254"):
        return "+" + phone

    return "+254" + phone[-9:]


def sms_was_successful(response):
    if not response:
        return False

    if isinstance(response, str):
        return True

    if response.get("backend") == "console":
        return True

    recipients = response.get("SMSMessageData", {}).get("Recipients", [])
    return any(
        recipient.get("statusCode") == 100 or recipient.get("status") == "Success"
        for recipient in recipients
    )


def send_sms(phone, message):
    try:
        phone = format_phone(phone)

        print(f"SMS to {phone}:")
        print(message)

        if settings.SMS_BACKEND == "console":
            return {"backend": "console", "recipients": [phone], "message": message}

        if settings.SMS_BACKEND == "hostpinnacle":
            return send_hostpinnacle_sms(phone, message)

        if not sms:
            print("SMS ERROR: Africa's Talking is not configured. Set AFRICASTALKING_API_KEY, SMS_BACKEND=hostpinnacle, or SMS_BACKEND=console.")
            return None

        response = sms.send(
            message=message,
            recipients=[phone],
            timeout=settings.SMS_TIMEOUT,
        )

        print("SMS RESPONSE:", response)
        return response

    except Exception as exc:
        print("SMS ERROR:", str(exc))
        return None
