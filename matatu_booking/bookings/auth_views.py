# bookings/auth_views.py
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from .auth_serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserDetailSerializer
)


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
def logout_user(request):
    """
    POST /api/auth/logout/
    Logs out the user.
    """
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
