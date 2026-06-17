from django.urls import path
from .views import c2b_confirmation, c2b_validation, mpesa_callback

urlpatterns = [
    # path("callback/", mpesa_callback),
    path("callback/", mpesa_callback, name="mpesa_callback"),
    path("c2b/validation/", c2b_validation, name="c2b_validation"),
    path("c2b/confirmation/", c2b_confirmation, name="c2b_confirmation"),
]
