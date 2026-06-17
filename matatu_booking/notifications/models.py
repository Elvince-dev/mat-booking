from django.db import models


class SecurityEvent(models.Model):
    EVENT_TYPES = [
        ('admin_password_reset_attempt', 'Admin password reset attempt'),
    ]

    event_type = models.CharField(max_length=80, choices=EVENT_TYPES)
    email = models.EmailField()
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_event_type_display()} for {self.email}"
