from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0002_booking_payment_group"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="booking",
            unique_together=set(),
        ),
    ]
