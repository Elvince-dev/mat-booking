from django.contrib import admin
from .models import Route, Bus, Trip, Booking


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("name", "origin", "destination")
    search_fields = ("name", "origin", "destination")


@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ("plate_number", "vehicle_type", "capacity", "driver_name", "is_active")
    list_filter = ("vehicle_type", "is_active")
    search_fields = ("plate_number", "driver_name")


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("route", "bus", "date", "departure_time", "arrival_time", "fare")
    list_filter = ("date", "route", "bus__vehicle_type")
    search_fields = ("route__name", "route__origin", "route__destination", "bus__plate_number")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("reference", "passenger_name", "phone_number", "trip", "seat_number", "status", "created_at")
    list_filter = ("status", "created_at", "trip__route")
    search_fields = ("reference", "passenger_name", "phone_number", "seat_number")
    readonly_fields = ("created_at", "qr_code")
