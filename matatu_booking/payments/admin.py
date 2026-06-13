from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("checkout_request_id", "booking", "phone", "amount", "status", "mpesa_receipt", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("checkout_request_id", "merchant_request_id", "mpesa_receipt", "phone", "booking__reference")
    readonly_fields = ("created_at",)
