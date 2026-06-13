from django.conf import settings
from django.core.management.base import BaseCommand

from payments.mpesa import MpesaRequestError, get_access_token, normalize_phone_number


class Command(BaseCommand):
    help = "Check M-Pesa sandbox configuration without initiating an STK push."

    def add_arguments(self, parser):
        parser.add_argument("--phone", default="0712345678")

    def handle(self, *args, **options):
        callback = settings.MPESA_CALLBACK_URL
        self.stdout.write(f"Callback URL: {callback}")
        self.stdout.write(f"Consumer key configured: {bool(settings.CONSUMER_KEY)}")
        self.stdout.write(f"Consumer secret configured: {bool(settings.CONSUMER_SECRET)}")
        self.stdout.write(f"Passkey configured: {bool(settings.PASSKEY)}")

        try:
            normalized_phone = normalize_phone_number(options["phone"])
        except MpesaRequestError as exc:
            self.stderr.write(self.style.ERROR(f"Phone check failed: {exc}"))
            return

        self.stdout.write(f"Normalized phone: {normalized_phone}")

        try:
            token = get_access_token()
        except MpesaRequestError as exc:
            self.stderr.write(self.style.ERROR(f"Access token check failed: {exc}"))
            return

        self.stdout.write(self.style.SUCCESS(f"Access token received: {bool(token)}"))
