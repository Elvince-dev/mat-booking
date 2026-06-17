// frontend/src/components/passenger-flow.tsx
import { useState, useEffect } from "react";
import {
  Bus, MapPin, ChevronLeft, ChevronRight, Clock, Star,
  User, Phone, CheckCircle, Smartphone,
  Download, Ticket, Home, Search, Loader2, Plus, Minus,
  Shield, ArrowRight, Bell, X,
} from "lucide-react";
import {
  getRoutes,
  getSeatMap,
  createBooking,
  getBookingStatus,
  getPaymentStatus,
  getUserBookings,
  type Route,
  type Trip,
  type SeatMap,
  type BookingStatus,
  type UserBooking,
} from "../../services/api";

export type PassengerScreen =
  | "search" | "seats" | "passenger" | "payment" | "pending" | "success" | "bookings" | "payment_failed";

interface BookingData {
  from: string; to: string; date: string;
  tripId: string | null;
  tripDetails: Trip | null;
  selectedSeats: string[];
  name: string; phone: string;
  paymentMethod: "mpesa_direct" | "mpesa_sms";
  ref: string;
  bookingId: number | null;
  checkoutRequestId: string | null;
  smsPaybill: string | null;
  smsAccountNumber: string | null;
  smsSent: boolean | null;
}

interface PassengerFlowProps {
  initialFrom?: string;
  initialTo?: string;
  initialDate?: string;
  initialScreen?: PassengerScreen;
  onBack: () => void;
}

const DEFAULT_BOOKING: BookingData = {
  from: "Nakuru", to: "Kisumu", date: new Date().toISOString().split("T")[0],
  tripId: null, tripDetails: null, selectedSeats: [],
  name: "", phone: "",
  paymentMethod: "mpesa_direct", ref: "", bookingId: null, checkoutRequestId: null,
  smsPaybill: null, smsAccountNumber: null, smsSent: null,
};

function formatTripTime(time?: string) {
  if (!time) return "";
  const [hourPart, minutePart = "00"] = time.split(":");
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return time;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${minutePart.padStart(2, "0")} ${suffix}`;
}

// Helper components (PhoneHeader, PhoneNav) â€“ keep as is from original
function PhoneHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="bg-gradient-to-r from-[#0D2B5E] to-[#1565C0] px-4 pt-11 pb-4 flex items-center gap-3 flex-shrink-0">
      <button onClick={onBack} className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="text-white font-extrabold text-[17px] leading-none truncate">{title}</h2>
        {subtitle && <p className="text-white/55 text-xs mt-0.5 truncate">{subtitle}</p>}
      </div>
      <button className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center relative flex-shrink-0">
        <Bell className="w-4 h-4 text-white" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-[#1565C0]" />
      </button>
    </div>
  );
}

function PhoneNav({ current, onChange }: { current: PassengerScreen; onChange: (s: PassengerScreen) => void }) {
  const tabs = [
    { id: "search" as PassengerScreen, Icon: Home, label: "Home" },
    { id: "bookings" as PassengerScreen, Icon: Ticket, label: "Bookings" },
    { id: "passenger" as PassengerScreen, Icon: User, label: "Profile" },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border flex z-40 flex-shrink-0">
      {tabs.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${current === id || (current === "bookings" && id === "bookings") ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`p-1.5 rounded-xl transition-all ${(current === id) ? "bg-primary/10" : ""}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">{label}</span>
        </button>
      ))}
    </div>
  );
}

// â”€â”€â”€ Screen 1: Trip Search (Real API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TripSearchScreen({ booking, updateBooking, onNavigate }: {
  booking: BookingData; updateBooking: (u: Partial<BookingData>) => void; onNavigate: (s: PassengerScreen) => void;
}) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "morning" | "afternoon">("all");

  useEffect(() => {
    async function fetchRoutes() {
      setLoading(true);
      const result = await getRoutes(booking.date);
      if (result.error) setError(result.error);
      else if (result.data) setRoutes(result.data);
      setLoading(false);
    }
    fetchRoutes();
  }, [booking.date]);

  const allTrips: (Trip & { route: Route })[] = [];
  // Be forgiving with whitespace/casing from user input and DB values.
  const fromFilter = (booking.from || "").toString().trim().toLowerCase();
  const toFilter = (booking.to || "").toString().trim().toLowerCase();

  routes.forEach(route => {
    const routeOrigin = (route.origin || "").toString().trim().toLowerCase();
    const routeDestination = (route.destination || "").toString().trim().toLowerCase();

    // If no from/to provided, or they match after normalization, include trips
    if (!fromFilter || !toFilter || (routeOrigin === fromFilter && routeDestination === toFilter)) {
      route.trips.forEach(trip => {
        allTrips.push({ ...trip, route });
      });
    }
  });

  const filteredTrips = allTrips.filter(trip => {
    if (filter === "all") return true;
    const hour = parseInt(trip.departure_time.split(":")[0]);
    return filter === "morning" ? hour < 12 : hour >= 12;
  });

  const dateDisplay = new Date(booking.date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });

  if (loading) return <div className="flex items-center justify-center h-full">Loading trips...</div>;
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-br from-[#0D2B5E] to-[#1565C0] px-4 pt-11 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white/60 text-xs font-semibold">NJOROLINE</p>
            <h2 className="text-white font-extrabold text-[17px] leading-none">Available Trips</h2>
          </div>
          <button className="ml-auto w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center relative">
            <Bell className="w-4 h-4 text-white" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-[#1565C0]" />
          </button>
        </div>
        <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-white font-bold text-sm">{booking.from}</span>
          <ArrowRight className="w-4 h-4 text-white/50 flex-shrink-0" />
          <span className="text-white font-bold text-sm">{booking.to}</span>
          <span className="text-white/40 text-xs ml-auto">{dateDisplay}</span>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 bg-card border-b border-border flex-shrink-0 overflow-x-auto scrollbar-none">
        {(["all","morning","afternoon"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-all ${filter === f ? "bg-primary text-white shadow-md shadow-primary/25" : "bg-muted text-muted-foreground"}`}>
            {f === "all" ? "All Times" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
        {filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-muted rounded-3xl flex items-center justify-center mb-3">
              <Bus className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-foreground font-bold">No trips found</p>
            <p className="text-muted-foreground text-sm mt-1">Try changing the route or date</p>
          </div>
        ) : filteredTrips.map(trip => (
          <div key={trip.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1565C0]/8 to-transparent px-4 py-3 border-b border-border flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Bus className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-foreground font-bold text-sm">{trip.bus.vehicle_type}</p>
                <p className="text-muted-foreground text-xs">{trip.bus.plate_number}</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div>
                  <p className="text-foreground font-extrabold text-2xl leading-none">{formatTripTime(trip.departure_time)}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{trip.route.origin}</p>
                </div>
                <div className="flex-1 flex flex-col items-center gap-0.5 mx-1">
                  <div className="flex items-center w-full gap-1">
                    <div className="flex-1 h-px bg-border" />
                    <Bus className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-foreground font-extrabold text-2xl leading-none">{formatTripTime(trip.arrival_time)}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{trip.route.destination}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-extrabold text-xl">KES <span className="text-accent">{trip.fare}</span></p>
                  <p className="text-muted-foreground text-xs"><span className="text-accent font-bold">{trip.available_seats.available}</span> seats left</p>
                </div>
                <button
                  onClick={() => { updateBooking({ tripId: trip.id.toString(), tripDetails: trip, selectedSeats: [] }); onNavigate("seats"); }}
                  className="bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-md shadow-primary/25 active:scale-95 transition-transform">
                  Book Seat
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className="h-2" />
      </div>
    </div>
  );
}

// â”€â”€â”€ Screen 2: Seat Selection (Real API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SeatScreen({ booking, updateBooking, onNavigate }: {
  booking: BookingData; updateBooking: (u: Partial<BookingData>) => void; onNavigate: (s: PassengerScreen) => void;
}) {
  const [seatMap, setSeatMap] = useState<{ label: string; is_booked: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tripId = booking.tripId ? parseInt(booking.tripId) : null;

  useEffect(() => {
    async function loadSeatMap() {
      if (!tripId) return;
      setLoading(true);
      const result = await getSeatMap(tripId);
      if (result.error) setError(result.error);
      else if (result.data) setSeatMap(result.data.seat_map);
      setLoading(false);
    }
    loadSeatMap();
  }, [tripId]);

  const toggleSeat = (label: string, isBooked: boolean) => {
    if (isBooked) return;
    const cur = booking.selectedSeats;
    if (cur.includes(label)) {
      updateBooking({ selectedSeats: cur.filter(s => s !== label) });
    } else {
      updateBooking({ selectedSeats: [...cur, label] });
    }
  };

  const seatCls = (isBooked: boolean, isSelected: boolean) => {
    const base = "h-9 rounded-xl flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0 cursor-pointer";
    if (isBooked) return `${base} bg-muted border-border text-muted-foreground cursor-not-allowed opacity-60 w-8`;
    if (isSelected) return `${base} bg-primary border-primary text-white shadow-md w-9`;
    return `${base} bg-accent/12 border-accent text-accent hover:bg-accent/25 w-9`;
  };

  const total = booking.selectedSeats.length * (booking.tripDetails?.fare ?? 0);
  const trip = booking.tripDetails;

  if (loading) return <div className="flex items-center justify-center h-full">Loading seat map...</div>;
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;

  return (
    <div className="flex flex-col h-full">
      <PhoneHeader title="Select Your Seat" subtitle={`${trip?.bus.vehicle_type} · ${trip?.bus.plate_number}`} onBack={() => onNavigate("search")} />
      <div className="flex justify-center gap-5 py-3 bg-card border-b border-border flex-shrink-0">
        {[{ label: "Available", cls: "bg-accent/15 border-2 border-accent" }, { label: "Selected", cls: "bg-primary border-2 border-primary" }, { label: "Booked", cls: "bg-muted border-2 border-border opacity-60" }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded-md ${l.cls}`} />
            <span className="text-xs text-muted-foreground font-medium">{l.label}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pb-32 px-4 py-4">
        <div className="bg-card rounded-3xl border-2 border-border p-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {seatMap.map(seat => {
              const isSelected = booking.selectedSeats.includes(seat.label);
              return (
                <button
                  key={seat.label}
                  onClick={() => toggleSeat(seat.label, seat.is_booked)}
                  className={seatCls(seat.is_booked, isSelected)}
                  disabled={seat.is_booked}
                >
                  {isSelected ? seat.label : seat.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-center text-muted-foreground text-sm font-medium mt-4">
          Select one or more seats from the map above.
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Seats selected</p>
            <p className="text-foreground font-bold text-sm">{booking.selectedSeats.length > 0 ? booking.selectedSeats.join(", ") : "None"}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs font-medium">Total</p>
            <p className="text-foreground font-extrabold text-lg">KES {total.toLocaleString()}</p>
          </div>
        </div>
        <button
          disabled={booking.selectedSeats.length === 0}
          onClick={() => onNavigate("passenger")}
          className="w-full bg-primary text-white font-extrabold py-4 rounded-2xl text-sm shadow-lg shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
          Continue to Details
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Screen 3: Passenger Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PassengerInfoScreen({ booking, updateBooking, onNavigate }: {
  booking: BookingData; updateBooking: (u: Partial<BookingData>) => void; onNavigate: (s: PassengerScreen) => void;
}) {
  const fields = [
    { key: "name" as const, label: "Full Name", icon: User, placeholder: "e.g. Grace Wanjiku", type: "text" },
    { key: "phone" as const, label: "Phone Number", icon: Phone, placeholder: "e.g. 0712 345 678", type: "tel" },
  ];
  const isValid = booking.name && booking.phone;
  const total = booking.selectedSeats.length * (booking.tripDetails?.fare ?? 0);

  return (
    <div className="flex flex-col h-full">
      <PhoneHeader title="Passenger Details" subtitle="Step 3 of 5" onBack={() => onNavigate("seats")} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28">
        <div className="bg-primary/8 border border-primary/20 rounded-2xl p-3.5 flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bus className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-bold text-sm truncate">{booking.tripDetails?.route.name}</p>
            <p className="text-muted-foreground text-xs">{formatTripTime(booking.tripDetails?.departure_time)}  Seats: {booking.selectedSeats.join(", ")}</p>
          </div>
          <span className="text-primary font-extrabold text-sm">KES {total}</span>
        </div>
        <h3 className="text-foreground font-extrabold text-sm mb-4">Traveller Information</h3>
        <div className="space-y-3.5">
          {fields.map(({ key, label, icon: Icon, placeholder, type }) => (
            <div key={key}>
              <label className="text-foreground text-sm font-semibold mb-1.5 block">{label}</label>
              <div className="relative">
                <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={type} value={booking[key]} onChange={e => updateBooking({ [key]: e.target.value } as Partial<BookingData>)}
                  placeholder={placeholder}
                  className="w-full bg-muted border-2 border-transparent focus:border-primary/30 rounded-xl py-3.5 pl-11 pr-4 text-foreground text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 bg-muted rounded-2xl p-4 flex gap-3">
          <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground text-xs leading-relaxed">Your details are encrypted and secure. Only used for your booking and digital ticket.</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4">
        <button disabled={!isValid} onClick={() => onNavigate("payment")}
          className="w-full bg-primary text-white font-extrabold py-4 rounded-2xl text-sm shadow-lg shadow-primary/30 disabled:opacity-40 active:scale-[0.98] transition-all">
          Proceed to Payment
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Screen 4: Payment (Real API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PaymentScreen({ booking, updateBooking, onNavigate, setBookingId }: {
  booking: BookingData; updateBooking: (u: Partial<BookingData>) => void;
  onNavigate: (s: PassengerScreen) => void; setBookingId: (id: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fare = booking.tripDetails?.fare ?? 0;
  const subtotal = fare * booking.selectedSeats.length;
  const total = subtotal;

  const handlePay = async () => {
    if (!booking.tripId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const payload = {
      trip: parseInt(booking.tripId),
      passenger_name: booking.name,
      phone_number: booking.phone,
      seat_numbers: booking.selectedSeats,
      payment_method: booking.paymentMethod,
    };
    const result = await createBooking(payload);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.data) {
      setBookingId(result.data.booking_id);
      updateBooking({ 
        ref: `BK-${result.data.booking_id}`, 
        bookingId: result.data.booking_id,
        checkoutRequestId: result.data.checkout_request_id,
        smsPaybill: result.data.paybill || null,
        smsAccountNumber: result.data.account_number || null,
        smsSent: typeof result.data.sms_sent === "boolean" ? result.data.sms_sent : null,
      });
      if (result.data.payment_method === "mpesa_sms") {
        setNotice(`${result.data.sms_sent ? "SMS sent." : "SMS could not be sent."} Use PayBill ${result.data.paybill} and Account ${result.data.account_number}.`);
      }
      onNavigate("pending");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PhoneHeader title="Payment" subtitle="Step 4 of 5" onBack={() => onNavigate("passenger")} />
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="text-foreground font-extrabold text-sm mb-3">Booking Summary</p>
          <div className="flex items-center gap-3 pb-3 border-b border-border mb-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-foreground font-bold text-sm">{booking.tripDetails?.route.name}</p>
              <p className="text-muted-foreground text-xs">{booking.tripDetails?.bus.plate_number} {formatTripTime(booking.tripDetails?.departure_time)}</p>
            </div>
          </div>
          {[
            ["Passenger", booking.name],
            ["Seat(s)", booking.selectedSeats.join(", ")],
            [`${booking.selectedSeats.length}* Fare`, `KES ${subtotal.toLocaleString()}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">{k}</span>
              <span className="text-foreground font-semibold text-sm">{v}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border mt-1">
            <span className="text-foreground font-extrabold">Total</span>
            <span className="text-primary font-extrabold text-lg">KES {total.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <p className="text-foreground font-extrabold text-sm mb-3">Payment Method</p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => updateBooking({ paymentMethod: "mpesa_direct" })}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 ${booking.paymentMethod === "mpesa_direct" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="w-11 h-11 rounded-2xl bg-accent/15 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-bold text-sm">M-Pesa Direct</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-accent bg-accent/10 border border-accent/25">Direct</span>
                </div>
                <p className="text-muted-foreground text-xs">Prompt sent to your phone via STK Push.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${booking.paymentMethod === "mpesa_direct" ? "border-primary bg-primary" : "border-border"}`}>
                {booking.paymentMethod === "mpesa_direct" && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateBooking({ paymentMethod: "mpesa_sms" })}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 ${booking.paymentMethod === "mpesa_sms" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <p className="text-foreground font-bold text-sm">M-Pesa SMS</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-primary bg-primary/10 border border-primary/25">Instructions</span>
                </div>
                <p className="text-muted-foreground text-xs">Receive PayBill and account instructions by SMS.</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${booking.paymentMethod === "mpesa_sms" ? "border-primary bg-primary" : "border-border"}`}>
                {booking.paymentMethod === "mpesa_sms" && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
          </div>
        </div>
        {notice && <div className="bg-primary/10 text-primary p-3 rounded-xl text-sm">{notice}</div>}
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4">
        <button onClick={handlePay} disabled={loading}
          className="w-full font-extrabold py-4 rounded-2xl text-sm text-white shadow-lg active:scale-[0.98] transition-all"
          style={{ backgroundColor: "#00C853", boxShadow: "0 8px 24px rgba(0,200,83,0.3)" }}>
          {loading ? "Processing..." : booking.paymentMethod === "mpesa_sms" ? "Send Payment Instructions" : `Pay KES ${total.toLocaleString()} Now`}
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Polling Hook (for payment status)
function usePollPaymentStatus(bookingId: number | null, checkoutRequestId: string | null, onComplete: (status: BookingStatus) => void) {
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    let interval: NodeJS.Timeout;
    const poll = async () => {
      // Try to poll by checkout_request_id first (more direct), fall back to booking_id
      if (checkoutRequestId) {
        const result = await getPaymentStatus(checkoutRequestId);
        if (result.data) {
          // Convert payment status response to booking status
          const bookingStatus: BookingStatus = {
            id: result.data.booking_id,
            reference: result.data.booking_reference,
            passenger_name: "",
            phone_number: "",
            seat_number: result.data.seat_numbers?.join(", ") || "",
            seat_numbers: result.data.seat_numbers,
            status: result.data.booking_status,
            created_at: new Date().toISOString(),
            trip: {} as any,
            payment_status: result.data.payment_status,
            mpesa_receipt: result.data.mpesa_receipt,
            qr_code: result.data.qr_code,
            qr_codes: result.data.qr_codes,
            ticket_download_url: result.data.ticket_download_url,
          };
          setStatus(bookingStatus);
          if (result.data.booking_status === "confirmed" || result.data.booking_status === "payment_failed") {
            setIsPolling(false);
            clearInterval(interval);
            onComplete(bookingStatus);
          }
        } else if (result.error) {
          setError(result.error);
          setIsPolling(false);
          clearInterval(interval);
        }
      } else {
        // Fallback to booking ID polling
        const result = await getBookingStatus(bookingId);
        if (result.error) {
          setError(result.error);
          setIsPolling(false);
          clearInterval(interval);
          return;
        }
        if (result.data) {
          setStatus(result.data);
          if (result.data.status === "confirmed" || result.data.status === "payment_failed") {
            setIsPolling(false);
            clearInterval(interval);
            onComplete(result.data);
          }
        }
      }
    };
    setIsPolling(true);
    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [bookingId, checkoutRequestId, onComplete]);

  return { status, error, isPolling };
}

// â”€â”€â”€ Screen 5: Pending (Polling) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PendingScreen({ booking, bookingId, checkoutRequestId, onNavigate }: { booking: BookingData; bookingId: number; checkoutRequestId: string | null; onNavigate: (s: PassengerScreen, booking?: BookingStatus) => void }) {
  const { error, isPolling } = usePollPaymentStatus(bookingId, checkoutRequestId, (finalStatus) => {
    if (finalStatus.status === "confirmed") onNavigate("success", finalStatus);
    else onNavigate("payment_failed");
  });
  const isSmsPayment = !checkoutRequestId;

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
      <h2 className="text-foreground font-extrabold text-xl">{isSmsPayment ? "Payment Instructions Sent" : "Waiting for Payment"}</h2>
      <p className="text-muted-foreground mt-2">
        {isSmsPayment ? "Check your SMS for the PayBill, account number, and amount." : "Complete the M-Pesa prompt on your phone."}
      </p>
      {isSmsPayment && booking.smsPaybill && booking.smsAccountNumber && (
        <div className="mt-5 w-full rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{booking.smsSent ? "SMS sent" : "Use these details"}</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">PayBill</span>
              <span className="font-extrabold text-foreground">{booking.smsPaybill}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Account</span>
              <span className="font-extrabold text-foreground">{booking.smsAccountNumber}</span>
            </div>
          </div>
        </div>
      )}
      <p className="text-muted-foreground text-sm mt-1">
        {isSmsPayment ? "Your booking is pending until payment is confirmed by staff." : "This page will refresh automatically once payment is confirmed."}
      </p>
      {error && <p className="text-red-500 mt-4">Error: {error}</p>}
    </div>
  );
}

// â”€â”€â”€ Screen 6: Success â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SuccessScreen({ booking, finalBooking, onNavigate }: {
  booking: BookingData; finalBooking?: BookingStatus; onNavigate: (s: PassengerScreen) => void;
}) {
  const fare = booking.tripDetails?.fare ?? 0;
  const displaySeats = finalBooking?.seat_numbers?.length
    ? finalBooking.seat_numbers
    : booking.selectedSeats;
  const total = fare * displaySeats.length;
  const bookingReference = finalBooking?.reference || booking.ref;
  const qrCodeUrl = finalBooking?.qr_code;
  const ticketDownloadUrl = finalBooking?.ticket_download_url || (finalBooking?.id ? `/api/bookings/${finalBooking.id}/ticket/` : null);
  const ticketDetails: [string, string][] = [
    ["Passenger", booking.name],
    ["Vehicle", booking.tripDetails?.bus.plate_number ?? ""],
    ["Seat(s)", displaySeats.join(", ")],
    ["Total Paid", `KES ${total.toLocaleString()}`],
    ["Booking Ref", bookingReference],
    ["Status", "Confirmed"],
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-gradient-to-b from-[#00A651] to-[#00C853] px-6 pt-14 pb-14 flex flex-col items-center relative overflow-hidden flex-shrink-0">
        <div className="absolute -bottom-8 left-0 right-0 h-16 bg-background rounded-t-[2rem]" />
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-black/15 mb-4 relative z-10">
          <CheckCircle className="w-12 h-12 text-accent" />
        </div>
        <h1 className="text-white font-extrabold text-2xl text-center relative z-10">Booking Confirmed!</h1>
        <p className="text-white/75 text-sm mt-1 relative z-10">Your digital ticket is ready</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 -mt-2 pb-6">
        <div className="bg-card rounded-3xl border-2 border-accent/30 shadow-xl shadow-accent/10 overflow-hidden mb-4">
          <div className="px-5 pt-5 pb-4 border-b-2 border-dashed border-border">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">NJOROLINE  E-TICKET</p>
                <p className="text-foreground font-extrabold text-base">{booking.tripDetails?.bus.vehicle_type}</p>
              </div>
              <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-full text-accent bg-accent/10 border border-accent/20">CONFIRMED</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-extrabold text-2xl leading-none">{formatTripTime(booking.tripDetails?.departure_time)}</p>
                <p className="text-muted-foreground text-sm">{booking.tripDetails?.route.origin}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <div className="w-6 h-px bg-border" /><Bus className="w-4 h-4" /><div className="w-6 h-px bg-border" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-foreground font-extrabold text-2xl leading-none">{formatTripTime(booking.tripDetails?.arrival_time)}</p>
                <p className="text-muted-foreground text-sm">{booking.tripDetails?.route.destination}</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {ticketDetails.map(([k, v]) => (
                <div key={k}>
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">{k}</p>
                  <p className="text-foreground font-bold text-sm mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center py-4 bg-muted rounded-2xl">
              <div className="w-28 h-28 bg-white rounded-md flex items-center justify-center overflow-hidden border border-border">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Ticket QR code" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground text-center px-2">QR preparing</span>
                )}
              </div>
              <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-2">Scan at Boarding</p>
              <p className="text-foreground font-bold text-sm mt-0.5">{bookingReference}</p>
            </div>
          </div>
        </div>
        <a
          href={ticketDownloadUrl || undefined}
          download
          aria-disabled={!ticketDownloadUrl}
          onClick={(event) => {
            if (!ticketDownloadUrl) event.preventDefault();
          }}
          className={`w-full flex items-center justify-center gap-2 bg-card border-2 border-border text-foreground font-bold py-4 rounded-2xl text-sm mb-3 active:scale-[0.98] transition-transform ${!ticketDownloadUrl ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Download className="w-4 h-4" />
          Download Ticket
        </a>
        <button onClick={() => onNavigate("bookings")}
          className="w-full bg-primary text-white font-extrabold py-4 rounded-2xl text-sm shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform">
          View My Bookings
        </button>
        <button onClick={() => onNavigate("search")} className="w-full mt-3 text-primary font-semibold py-3 text-sm">
          Book Another Trip
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Screen 7: My Bookings (Mock â€“ can be replaced with real API later) â”€â”€â”€â”€â”€â”€
function MyBookingsScreen({ onNavigate }: { onNavigate: (s: PassengerScreen) => void }) {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getUserBookings()
      .then(result => {
        if (!active) return;
        if (result.data) {
          setBookings(result.data);
          setError("");
        } else {
          setError(result.error || "Unable to load your bookings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-br from-[#0D2B5E] to-[#1565C0] px-5 pt-11 pb-5 flex-shrink-0">
        <h2 className="text-white font-extrabold text-xl">My Bookings</h2>
        <p className="text-white/70 text-sm mt-1">Your booked trips and ticket details</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error === "HTTP 403" ? "Please log in to view your booking history." : error}
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Ticket className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="font-bold text-foreground">No bookings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Trips you book while logged in will appear here.</p>
            <button onClick={() => onNavigate("search")} className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
              Book a Trip
            </button>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-3">
            {bookings.map(item => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-foreground">{item.origin} to {item.destination}</p>
                    <p className="text-xs text-muted-foreground">{item.trip_date} · {formatTripTime(item.departure_time)} · {item.vehicle}</p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold capitalize text-primary">
                    {item.status.replace("_", " ")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Seat</p>
                    <p className="font-bold text-foreground">{item.seat_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fare</p>
                    <p className="font-bold text-foreground">KES {Number(item.fare).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference</p>
                    <p className="font-mono text-xs font-bold text-foreground">{item.reference || item.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment</p>
                    <p className="font-bold text-foreground">{item.payment_status || "PENDING"}</p>
                  </div>
                </div>
                {item.qr_code && (
                  <a href={item.qr_code} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-primary">
                    <Ticket className="h-4 w-4" />
                    Open Ticket
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Failure Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PaymentFailedScreen({ onNavigate }: { onNavigate: (s: PassengerScreen) => void }) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center">
      <X className="w-16 h-16 text-destructive mb-4" />
      <h2 className="text-foreground font-extrabold text-xl">Payment Failed</h2>
      <p className="text-muted-foreground mt-2">Your booking could not be completed.</p>
      <button onClick={() => onNavigate("search")} className="mt-6 bg-primary text-white font-bold py-3 px-6 rounded-xl">
        Try Again
      </button>
    </div>
  );
}

// â”€â”€â”€ Main PassengerFlow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function PassengerFlow({ initialFrom = "Nakuru", initialTo = "Kisumu", initialDate, initialScreen, onBack }: PassengerFlowProps) {
  const [screen, setScreen] = useState<PassengerScreen>(initialScreen || "search");
  const [booking, setBooking] = useState<BookingData>({
    ...DEFAULT_BOOKING, from: initialFrom, to: initialTo, date: initialDate || DEFAULT_BOOKING.date,
  });
  const [currentBookingId, setCurrentBookingId] = useState<number | null>(null);
  const [finalBookingData, setFinalBookingData] = useState<BookingStatus | undefined>();

  const updateBooking = (u: Partial<BookingData>) => setBooking(prev => ({ ...prev, ...u }));

  const navigateWithBooking = (newScreen: PassengerScreen, bookingData?: BookingStatus) => {
    if (bookingData) setFinalBookingData(bookingData);
    setScreen(newScreen);
  };

  const showBottomNav = ["search", "bookings"].includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case "search": return <TripSearchScreen booking={booking} updateBooking={updateBooking} onNavigate={setScreen} />;
      case "seats": return <SeatScreen booking={booking} updateBooking={updateBooking} onNavigate={setScreen} />;
      case "passenger": return <PassengerInfoScreen booking={booking} updateBooking={updateBooking} onNavigate={setScreen} />;
      case "payment": return <PaymentScreen booking={booking} updateBooking={updateBooking} onNavigate={navigateWithBooking} setBookingId={setCurrentBookingId} />;
      case "pending": return currentBookingId ? <PendingScreen booking={booking} bookingId={currentBookingId} checkoutRequestId={booking.checkoutRequestId} onNavigate={navigateWithBooking} /> : <div>Error: no booking</div>;
      case "success": return <SuccessScreen booking={booking} finalBooking={finalBookingData} onNavigate={setScreen} />;
      case "bookings": return <MyBookingsScreen onNavigate={setScreen} />;
      case "payment_failed": return <PaymentFailedScreen onNavigate={setScreen} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#060F1E] flex items-center justify-center sm:p-6">
      <div className="fixed inset-0 bg-gradient-to-br from-[#0A1628] via-[#0D2B5E]/50 to-[#060F1E] pointer-events-none" />
      <button onClick={onBack}
        className="fixed top-4 left-4 z-50 sm:flex hidden items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-white/20 transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to Home
      </button>
      <div className="relative w-full max-w-[430px] bg-background overflow-hidden" style={{ height: "min(100dvh, 896px)", borderRadius: "clamp(0px, calc((100dvh - 896px) * 100), 2.5rem)", boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)" }}>
        <div className={`absolute inset-0 overflow-y-auto flex flex-col ${showBottomNav ? "pb-[64px]" : ""}`} style={{ scrollbarWidth: "none" }}>
          {renderScreen()}
        </div>
        {showBottomNav && <PhoneNav current={screen} onChange={setScreen} />}
      </div>
    </div>
  );
}

