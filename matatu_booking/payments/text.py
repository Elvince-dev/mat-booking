import requests

BASE_URL = "https://sms.hostpinnacle.co.ke/SMSApi/send"

USERNAME = "aganyo"  # usually your HostPinnacle account username
API_KEY = "cbca042ff2b80abe258757842a6eaae0e4d77c54"
SENDER_ID = "HostPinnacle"  # replace with your approved sender ID

def format_phone(phone):
    phone = str(phone).strip().replace("+", "").replace(" ", "")
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    elif not phone.startswith("254"):
        phone = "254" + phone[-9:]
    return phone

def send_sms(phone, message):
    try:
        phone = format_phone(phone)

        payload = {
            "userid": USERNAME,
            "password": API_KEY,
            "mobile": phone,
            "msg": message,
            "senderid": SENDER_ID,
            "duplicatecheck": "true"
        }

        response = requests.get(BASE_URL, params=payload)
        print("📩 RESPONSE:", response.text)
        return response.text

    except Exception as e:
        print("❌ SMS ERROR:", e)
        return None