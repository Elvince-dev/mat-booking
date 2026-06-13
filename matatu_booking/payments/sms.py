import africastalking

USERNAME = "sandbox"
API_KEY = "atsk_f7d85ee0da28a27276ddcec163fc12b07db7deeab9b27fc58953fa32c45f4c7d97e9707c"

africastalking.initialize(USERNAME, API_KEY)

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


def send_sms(phone, message):
    try:
        phone = format_phone(phone)

        print(f"📱 Sending SMS to: {phone}")

        response = sms.send(
            message=message,
            recipients=[phone]
        )

        print("📩 SMS RESPONSE:", response)
        return response

    except Exception as e:
        print("❌ SMS ERROR:", str(e))
        return None