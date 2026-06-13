from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Booking

@receiver(pre_save, sender=Booking)
def generate_reference(sender, instance, **kwargs):
    if not instance.reference:
        instance.reference = f"MTT-{str(uuid.uuid4())[:6].upper()}"