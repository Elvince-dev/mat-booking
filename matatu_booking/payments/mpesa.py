import requests
import base64
import time
from datetime import datetime
from django.conf import settings


class MpesaRequestError(Exception):
    """Raised when Daraja cannot be reached or returns an invalid response."""


def normalize_phone_number(phone):
    digits = "".join(ch for ch in str(phone) if ch.isdigit())

    if digits.startswith("0") and len(digits) == 10:
        return f"254{digits[1:]}"
    if digits.startswith("7") and len(digits) == 9:
        return f"254{digits}"
    if digits.startswith("254") and len(digits) == 12:
        return digits

    raise MpesaRequestError("Use a valid Kenyan Safaricom number, for example 0712345678 or 254712345678.")


def response_error_message(response, fallback):
    try:
        data = response.json()
    except ValueError:
        data = response.text[:300]
    return f"{fallback} Safaricom response: {data}"


def request_with_retries(method, url, *, attempts=3, retry_delay=1, **kwargs):
    last_error = None

    for attempt in range(1, attempts + 1):
        try:
            return method(url, **kwargs)
        except (
            requests.exceptions.SSLError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as exc:
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(retry_delay * attempt)

    raise last_error


def get_access_token():
    consumer_key = settings.CONSUMER_KEY
    consumer_secret = settings.CONSUMER_SECRET

    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

    try:
        response = request_with_retries(
            requests.get,
            url,
            auth=(consumer_key, consumer_secret),
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.HTTPError as exc:
        raise MpesaRequestError(response_error_message(exc.response, "Could not get M-Pesa access token.")) from exc
    except requests.exceptions.RequestException as exc:
        raise MpesaRequestError("Could not connect to Safaricom sandbox while getting access token.") from exc
    except ValueError as exc:
        raise MpesaRequestError("Safaricom sandbox returned an invalid access-token response.") from exc

    access_token = data.get("access_token")
    if not access_token:
        raise MpesaRequestError("Safaricom sandbox did not return an access token.")

    return access_token



def generate_password(shortcode, passkey):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    data = shortcode + passkey + timestamp
    encoded = base64.b64encode(data.encode())
    return encoded.decode("utf-8"), timestamp


def stk_push(phone, amount):
    access_token = get_access_token()
    phone = normalize_phone_number(phone)
    amount = int(float(amount))

    shortcode = "174379"
    passkey = settings.PASSKEY

    password, timestamp = generate_password(shortcode, passkey)

    url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": "MATATU",
        "TransactionDesc": "Seat Booking"
    }

    try:
        response = request_with_retries(
            requests.post,
            url,
            json=payload,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as exc:
        raise MpesaRequestError(response_error_message(exc.response, "M-Pesa rejected the STK push request.")) from exc
    except requests.exceptions.SSLError as exc:
        raise MpesaRequestError("Safaricom sandbox SSL connection failed. Please retry in a moment.") from exc
    except requests.exceptions.Timeout as exc:
        raise MpesaRequestError("Safaricom sandbox timed out before sending the payment prompt.") from exc
    except requests.exceptions.RequestException as exc:
        raise MpesaRequestError("Could not connect to Safaricom sandbox to send the payment prompt.") from exc
    except ValueError as exc:
        raise MpesaRequestError("Safaricom sandbox returned an invalid STK push response.") from exc
