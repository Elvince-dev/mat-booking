# matatu_booking/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({"message": "Njoroline API is running", "version": "1.0"})

urlpatterns = [
    path('', api_root, name='api_root'),   # nice JSON response at root
    path('admin/', admin.site.urls),
    path('api/', include('bookings.api_urls')),
    path('payments/', include('payments.urls')),
    path('login/', auth_views.LoginView.as_view(template_name="registration/login.html"), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)