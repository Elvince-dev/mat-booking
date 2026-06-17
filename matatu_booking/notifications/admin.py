from django.contrib import admin
from .models import SecurityEvent


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'email', 'ip_address', 'created_at')
    list_filter = ('event_type', 'created_at')
    search_fields = ('email', 'ip_address', 'user_agent')
    readonly_fields = ('event_type', 'email', 'ip_address', 'user_agent', 'created_at')
