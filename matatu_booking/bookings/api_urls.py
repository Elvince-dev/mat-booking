# bookings/api_urls.py
from django.urls import path
from . import api_views, auth_views

urlpatterns = [
    # Auth endpoints
    path('auth/register/', auth_views.register, name='api_register'),
    path('auth/login/', auth_views.login_user, name='api_login'),
    path('auth/logout/', auth_views.logout_user, name='api_logout'),
    path('auth/profile/', auth_views.user_profile, name='api_user_profile'),
    path('auth/password-reset/', auth_views.password_reset_request, name='api_password_reset'),
    path('auth/password-reset/confirm/', auth_views.password_reset_confirm, name='api_password_reset_confirm'),
    
    # Booking endpoints
    path('routes/', api_views.route_list, name='api_route_list'),
    path('trips/<int:trip_id>/seats/', api_views.trip_seat_map, name='api_trip_seats'),
    path('bookings/', api_views.create_booking, name='api_create_booking'),
    path('bookings/<int:booking_id>/status/', api_views.booking_status, name='api_booking_status'),
    path('bookings/<int:booking_id>/ticket/', api_views.download_booking_ticket, name='api_download_booking_ticket'),
    path('user/bookings/', api_views.user_bookings, name='api_user_bookings'),
    path('payment-status/', api_views.payment_status_check, name='api_payment_status'),
    path('admin/stats/', api_views.admin_stats, name='api_admin_stats'),
    path('admin/portal/', api_views.admin_portal_data, name='api_admin_portal'),
    path('admin/buses/', api_views.admin_create_bus, name='api_admin_create_bus'),
    path('admin/buses/<int:bus_id>/', api_views.admin_update_bus, name='api_admin_update_bus'),
    path('admin/routes/', api_views.admin_create_route, name='api_admin_create_route'),
    path('admin/routes/<int:route_id>/', api_views.admin_update_route, name='api_admin_update_route'),
    path('admin/trips/', api_views.admin_create_trip, name='api_admin_create_trip'),
    path('admin/trips/<int:trip_id>/', api_views.admin_update_trip, name='api_admin_update_trip'),
    path('admin/bookings/<int:booking_id>/action/', api_views.admin_booking_action, name='api_admin_booking_action'),
]
