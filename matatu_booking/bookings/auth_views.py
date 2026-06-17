# bookings/auth_views.py
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from notifications.models import SecurityEvent
from .auth_serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserDetailSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
import logging


logger = logging.getLogger(__name__)


def get_client_ip(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    """
    POST /api/auth/register/
    Body: { "username": "john_doe", "email": "john@example.com", "password": "pass123", "password_confirm": "pass123" }
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'message': 'User registered successfully',
            'user': UserDetailSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_user(request):
    """
    POST /api/auth/login/
    Body: { "username": "john_doe", "password": "pass123" }
    """
    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        login(request, user)
        return Response({
            'message': 'Login successful',
            'user': UserDetailSerializer(user).data,
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    GET /api/auth/profile/
    Returns current authenticated user's profile.
    """
    return Response(UserDetailSerializer(request.user).data)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email'].strip().lower()
    users = User.objects.filter(email__iexact=email, is_active=True)
    admin_users = users.filter(is_staff=True) | users.filter(is_superuser=True)

    if admin_users.exists():
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        SecurityEvent.objects.create(
            event_type='admin_password_reset_attempt',
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        logger.warning(
            "Blocked public admin password reset attempt for %s from %s",
            email,
            ip_address,
        )
        if settings.SECURITY_ALERT_EMAILS:
            send_mail(
                subject="Blocked admin password reset attempt",
                message=(
                    "A public password reset was requested for an admin account.\n\n"
                    f"Email: {email}\n"
                    f"IP address: {ip_address or 'unknown'}\n"
                    f"User agent: {user_agent or 'unknown'}\n\n"
                    "No reset link was sent. Admin passwords must be reset through the protected admin process."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=settings.SECURITY_ALERT_EMAILS,
                fail_silently=False,
            )
        return Response({'message': 'If an account exists, a reset link has been sent.'})

    users = users.filter(is_staff=False, is_superuser=False)

    for user in users:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        print(f"PASSWORD RESET LINK for {user.email}: {reset_url}")

        send_mail(
            subject="Reset your Njoroline password",
            message=(
                "Use this link to reset your Njoroline password:\n\n"
                f"{reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

    return Response({'message': 'If an account exists, a reset link has been sent.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']
    user.set_password(serializer.validated_data['password'])
    user.save()
    return Response({'message': 'Password reset successful. You can now log in.'})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def logout_user(request):
    """
    POST /api/auth/logout/
    Logs out the user.
    """
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
