from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="payment_group",
            field=models.CharField(blank=True, db_index=True, max_length=40, null=True),
        ),
    ]
