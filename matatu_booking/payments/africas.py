import os
import sys
from pathlib import Path

import django


BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "matatu_booking.settings")
django.setup()

from payments.sms import send_sms


if __name__ == "__main__":
    msg = send_sms(
        "254736905376",
        "Your booking has been confirmed. Thank you for using our service.",
    )
    print(msg)
