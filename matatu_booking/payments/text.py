import requests
from django.conf import settings


def format_phone(phone):
    phone = str(phone).strip().replace("+", "").replace(" ", "")
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    elif not phone.startswith("254"):
        phone = "254" + phone[-9:]
    return phone


def send_hostpinnacle_sms(phone, message):
    try:
        if not settings.HOSTPINNACLE_USERNAME or not settings.HOSTPINNACLE_API_KEY:
            print("SMS ERROR: HostPinnacle is not configured. Set HOSTPINNACLE_USERNAME and HOSTPINNACLE_API_KEY.")
            return None

        phone = format_phone(phone)

        payload = {
            "userid": settings.HOSTPINNACLE_USERNAME,
            "password": settings.HOSTPINNACLE_API_KEY,
            "mobile": phone,
            "msg": message,
            "senderid": settings.HOSTPINNACLE_SENDER_ID,
            "duplicatecheck": "true",
        }

        response = requests.get(settings.HOSTPINNACLE_SMS_URL, params=payload, timeout=settings.SMS_TIMEOUT)
        print("HostPinnacle SMS RESPONSE:", response.text)
        response.raise_for_status()
        return response.text

    except Exception as exc:
        print("HostPinnacle SMS ERROR:", str(exc))
        return None
