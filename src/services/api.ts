// frontend/src/services/api.ts

const API_BASE = import.meta.env.VITE_API_URL ?? ''; // empty in local dev so Vite proxy can handle /api

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

function formatApiError(errorData: unknown, fallback: string) {
  if (!errorData || typeof errorData !== 'object') return fallback;

  const data = errorData as Record<string, unknown>;
  const details = data.details;

  if (details && typeof details === 'object') {
    const detailObj = details as Record<string, unknown>;
    const darajaMessage =
      detailObj.errorMessage ||
      detailObj.ResponseDescription ||
      detailObj.CustomerMessage ||
      detailObj.ResultDesc;

    if (darajaMessage) {
      return `${data.error || 'Request failed'}: ${String(darajaMessage)}`;
    }

    return `${data.error || 'Request failed'}: ${JSON.stringify(detailObj)}`;
  }

  if (typeof data.error === 'string') return data.error;

  const fieldErrors = Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join('; ');

  return fieldErrors || fallback;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: formatApiError(errorData, `HTTP ${response.status}`) };
    }
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// ========== API Endpoints ==========

// GET /api/routes/?date=YYYY-MM-DD
export interface Route {
  id: number;
  name: string;
  origin: string;
  destination: string;
  trips: Trip[];
}

export interface Trip {
  id: number;
  route: Route;
  bus: {
    id: number;
    plate_number: string;
    capacity: number;
    vehicle_type: string;
    driver_name: string | null;
  };
  departure_time: string; // "07:00:00"
  arrival_time: string;
  fare: number;
  date: string;
  available_seats: {
    total: number;
    booked: number;
    available: number;
    list: string[]; // seat labels
  };
}

export async function getRoutes(date: string): Promise<ApiResponse<Route[]>> {
  return request<Route[]>(`/api/routes/?date=${date}`);
}

// GET /api/trips/<id>/seats/
export interface SeatMap {
  trip_id: number;
  bus_type: string;
  capacity: number;
  fare: number;
  departure_time: string;
  seat_map: { label: string; is_booked: boolean }[];
}

export async function getSeatMap(tripId: number): Promise<ApiResponse<SeatMap>> {
  return request<SeatMap>(`/api/trips/${tripId}/seats/`);
}

// POST /api/bookings/
export interface CreateBookingPayload {
  trip: number;
  passenger_name: string;
  phone_number: string;
  seat_number?: string;
  seat_numbers?: string[];
  payment_method?: 'mpesa_direct' | 'mpesa_sms';
}

export interface CreateBookingResponse {
  booking_id: number;
  booking_ids?: number[];
  seat_numbers?: string[];
  total_amount?: number;
  checkout_request_id: string | null;
  payment_method?: 'mpesa_direct' | 'mpesa_sms';
  paybill?: string;
  account_number?: string;
  sms_sent?: boolean;
  message: string;
}

export async function createBooking(payload: CreateBookingPayload): Promise<ApiResponse<CreateBookingResponse>> {
  return request<CreateBookingResponse>('/api/bookings/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// GET /api/bookings/<id>/status/
export interface BookingStatus {
  id: number;
  reference: string | null;
  passenger_name: string;
  phone_number: string;
  seat_number: string;
  seat_numbers?: string[];
  status: 'pending_payment' | 'confirmed' | 'payment_failed' | 'cancelled';
  created_at: string;
  trip: Trip;
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
  mpesa_receipt: string | null;
  qr_code: string | null;
  qr_codes?: string[];
  ticket_download_url?: string | null;
}

export async function getBookingStatus(bookingId: number): Promise<ApiResponse<BookingStatus>> {
  return request<BookingStatus>(`/api/bookings/${bookingId}/status/`);
}

export interface UserBooking {
  id: number;
  reference: string | null;
  passenger_name: string;
  phone_number: string;
  route: string;
  origin: string;
  destination: string;
  vehicle: string;
  trip_date: string;
  departure_time: string;
  arrival_time: string;
  seat_number: string;
  fare: number;
  status: 'pending_payment' | 'confirmed' | 'payment_failed' | 'cancelled';
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
  mpesa_receipt: string | null;
  created_at: string;
  qr_code: string | null;
}

export async function getUserBookings(): Promise<ApiResponse<UserBooking[]>> {
  return request<UserBooking[]>('/api/user/bookings/');
}

// GET /api/admin/stats/ (requires authentication)
export interface AdminStats {
  total_bookings: number;
  confirmed_bookings: number;
  failed_bookings: number;
  revenue: number;
  today_revenue: number;
  week_revenue: number;
  recent_bookings: {
    id: number;
    reference: string;
    passenger_name: string;
    phone_number: string;
    route: string;
    seat_number: string;
    fare: number;
    status: string;
    payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
    created_at: string;
  }[];
}

export async function getAdminStats(): Promise<ApiResponse<AdminStats>> {
  return request<AdminStats>('/api/admin/stats/');
}

export interface AdminPortalData {
  buses: {
    id: number;
    plate_number: string;
    capacity: number;
    vehicle_type: string;
    driver_name: string | null;
    is_active: boolean;
    trips_count: number;
  }[];
  routes: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    trips_count: number;
    bookings_count: number;
  }[];
  trips: {
    id: number;
    route_id: number;
    route: string;
    bus_id: number;
    bus: string;
    driver_name: string | null;
    date: string;
    departure_time: string;
    arrival_time: string;
    fare: number;
    capacity: number;
    booked_seats: number;
    confirmed_seats: number;
  }[];
  bookings: {
    id: number;
    reference: string | null;
    passenger_name: string;
    phone_number: string;
    route: string;
    vehicle: string;
    trip_date: string;
    departure_time: string;
    seat_number: string;
    fare: number;
    status: string;
    payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
    mpesa_receipt: string | null;
    created_at: string;
    qr_code: string | null;
  }[];
  payments: {
    id: number;
    checkout_request_id: string;
    merchant_request_id: string;
    booking_id: number;
    booking_reference: string | null;
    passenger_name: string;
    phone: string;
    amount: number;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    mpesa_receipt: string | null;
    created_at: string;
  }[];
  passengers: {
    name: string;
    phone_number: string;
    bookings: number;
    confirmed_bookings: number;
    last_booking_at: string;
  }[];
  registered_users: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    date_joined: string;
  }[];
}

export async function getAdminPortalData(): Promise<ApiResponse<AdminPortalData>> {
  return request<AdminPortalData>('/api/admin/portal/');
}

export async function createAdminBus(payload: Record<string, unknown>): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>('/api/admin/buses/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBus(busId: number, payload: Record<string, unknown>): Promise<ApiResponse<{ message: string; id: number }>> {
  return request<{ message: string; id: number }>(`/api/admin/buses/${busId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createAdminRoute(payload: Record<string, unknown>): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>('/api/admin/routes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminRoute(routeId: number, payload: Record<string, unknown>): Promise<ApiResponse<{ message: string; id: number }>> {
  return request<{ message: string; id: number }>(`/api/admin/routes/${routeId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminRoute(routeId: number): Promise<ApiResponse<{ message: string; id: number }>> {
  return request<{ message: string; id: number }>(`/api/admin/routes/${routeId}/`, {
    method: 'DELETE',
  });
}

export async function createAdminTrip(payload: Record<string, unknown>): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>('/api/admin/trips/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTrip(tripId: number, payload: Record<string, unknown>): Promise<ApiResponse<{ message: string; id: number }>> {
  return request<{ message: string; id: number }>(`/api/admin/trips/${tripId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBooking(bookingId: number, action: 'confirm' | 'cancel'): Promise<ApiResponse<{ message: string; status: string }>> {
  return request<{ message: string; status: string }>(`/api/admin/bookings/${bookingId}/action/`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

// GET /api/payment-status/?checkout_request_id=xxx
export interface PaymentStatusResponse {
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED';
  booking_status: 'pending_payment' | 'confirmed' | 'payment_failed' | 'cancelled';
  booking_id: number;
  booking_reference: string | null;
  seat_numbers?: string[];
  qr_code: string | null;
  qr_codes?: string[];
  mpesa_receipt: string | null;
  ticket_download_url?: string | null;
}

export async function getPaymentStatus(checkoutRequestId: string): Promise<ApiResponse<PaymentStatusResponse>> {
  return request<PaymentStatusResponse>(`/api/payment-status/?checkout_request_id=${checkoutRequestId}`);
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
}

export async function registerUser(payload: RegisterPayload): Promise<ApiResponse<{ message: string; user: UserProfile }>> {
  return request<{ message: string; user: UserProfile }>('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(username: string, password: string): Promise<ApiResponse<{ message: string; user: UserProfile }>> {
  return request<{ message: string; user: UserProfile }>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutUser(): Promise<ApiResponse<{ message: string }>> {
  return request<{ message: string }>('/api/auth/logout/', { method: 'POST' });
}

export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  return request<UserProfile>('/api/auth/profile/');
}

export async function requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
  return request<{ message: string }>('/api/auth/password-reset/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(
  uid: string,
  token: string,
  password: string,
  passwordConfirm: string
): Promise<ApiResponse<{ message: string }>> {
  return request<{ message: string }>('/api/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({
      uid,
      token,
      password,
      password_confirm: passwordConfirm,
    }),
  });
}
