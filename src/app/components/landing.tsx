import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bus, MapPin, Calendar, ArrowRight, Search,
  Smartphone, Shield, Clock, Zap, ChevronDown,
  Menu, X, MessageCircle,
} from "lucide-react";
import type { PassengerScreen } from "./passenger-flow";
import { getRoutes, type Route } from "../../services/api";

type AppMode = "landing" | "passenger" | "admin" | "login" | "register";

interface LandingProps {
  onNavigate: (mode: AppMode, from?: string, to?: string, screen?: PassengerScreen, date?: string) => void;
  userEmail?: string | null;
  onLogout: () => void;
}

const LOCATIONS = ["Nakuru", "Njoro", "Kisumu"];

type RouteSummary = {
  key: string;
  from: string;
  to: string;
  fare: number | null;
  tripCount: number | null;
  seatsAvailable: number | null;
  vehicleCount: number | null;
};

const FALLBACK_ROUTES: RouteSummary[] = [
  { key: "nakuru-njoro", from: "Nakuru", to: "Njoro", fare: null, tripCount: null, seatsAvailable: null, vehicleCount: null },
  { key: "njoro-kisumu", from: "Njoro", to: "Kisumu", fare: null, tripCount: null, seatsAvailable: null, vehicleCount: null },
  { key: "kisumu-nakuru", from: "Kisumu", to: "Nakuru", fare: null, tripCount: null, seatsAvailable: null, vehicleCount: null },
  { key: "nakuru-kisumu", from: "Nakuru", to: "Kisumu", fare: null, tripCount: null, seatsAvailable: null, vehicleCount: null },
];

const FEATURES = [
  { icon: Zap, title: "Easy Booking", desc: "Select your route, choose your seat, and complete payment with M-Pesa." },
  { icon: Smartphone, title: "M-Pesa Payments", desc: "Pay instantly with M-Pesa STK push. Secure, cashless, and fully digital." },
  { icon: Shield, title: "Digital Tickets", desc: "Get a QR-code e-ticket instantly. No paper tickets. Board with your phone." },
  { icon: Clock, title: "Current Schedules", desc: "View scheduled departures and seat availability from the booking system." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Search Your Trip", desc: "Select your origin, destination, and travel date." },
  { step: "02", title: "Choose Your Seat", desc: "Pick your preferred seat from the live interactive seat map." },
  { step: "03", title: "Pay & Travel", desc: "Pay instantly with M-Pesa. Receive your digital ticket and board with ease." },
];

const WHATSAPP_SUPPORT_NUMBER = "254113050613";
const WHATSAPP_SUPPORT_MESSAGE = "Hello Njoroline support, I need help with my booking.";
const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(WHATSAPP_SUPPORT_MESSAGE)}`;


export function LandingPage({ onNavigate, userEmail, onLogout }: LandingProps) {
  const [from, setFrom] = useState("Nakuru");
  const [to, setTo] = useState("Kisumu");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFromDrop, setShowFromDrop] = useState(false);
  const [showToDrop, setShowToDrop] = useState(false);
  const routesRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    setRoutesLoading(true);
    setRoutesError(null);

    getRoutes(date)
      .then(result => {
        if (!active) return;

        if (result.data) {
          setRoutes(result.data);
        } else {
          setRoutes([]);
          setRoutesError(result.error || "Unable to load routes.");
        }
      })
      .finally(() => {
        if (active) setRoutesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const routeSummaries = useMemo<RouteSummary[]>(() => {
    return routes.map(route => {
      const fares = route.trips
        .map(trip => Number(trip.fare))
        .filter(fare => Number.isFinite(fare));
      const vehicleIds = new Set(route.trips.map(trip => trip.bus.id));
      const seatsAvailable = route.trips.reduce((sum, trip) => sum + trip.available_seats.available, 0);

      return {
        key: String(route.id),
        from: route.origin,
        to: route.destination,
        fare: fares.length ? Math.min(...fares) : null,
        tripCount: route.trips.length,
        seatsAvailable,
        vehicleCount: vehicleIds.size,
      };
    });
  }, [routes]);

  const displayedRoutes = routeSummaries.length ? routeSummaries : FALLBACK_ROUTES;

  const routeStats = useMemo(() => {
    const tripCount = routes.reduce((sum, route) => sum + route.trips.length, 0);
    const vehicleIds = new Set(routes.flatMap(route => route.trips.map(trip => trip.bus.id)));
    const seatsAvailable = routes.reduce(
      (sum, route) => sum + route.trips.reduce((inner, trip) => inner + trip.available_seats.available, 0),
      0,
    );
    const value = (amount: number) => routesLoading ? "..." : String(amount);

    return [
      { value: value(routes.length), label: "Routes Listed" },
      { value: value(tripCount), label: "Trips This Date" },
      { value: value(vehicleIds.size), label: "Vehicles Scheduled" },
      { value: value(seatsAvailable), label: "Seats Available" },
    ];
  }, [routes, routesLoading]);

  const locationOptions = useMemo(() => {
    const routeLocations = routes.flatMap(route => [route.origin, route.destination]);
    return Array.from(new Set([...LOCATIONS, ...routeLocations]));
  }, [routes]);

  const scrollToSection = (section: "top" | "routes" | "contact") => {
    if (section === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const sectionRef = section === "routes" ? routesRef.current : contactRef.current;
    sectionRef?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startBooking = (from?: string, to?: string, travelDate = date) => {
    return onNavigate("passenger", from, to, undefined, travelDate);
  };

  const handleSearch = () => startBooking(from, to, date);
  const handleRoute = (r: RouteSummary) => startBooking(r.from, r.to, date);
  const openMyBookings = () => {
    if (!userEmail) return onNavigate("login");
    return onNavigate("passenger", undefined, undefined, "bookings");
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ scrollbarWidth: "none" }}>      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => scrollToSection("top")} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <span className="text-primary font-extrabold text-lg tracking-tight">NJOROLINE</span>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">Operators</p>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {["Home", "Routes", "My Bookings", "Contact"].map(item => (
              <button key={item}
                onClick={() => {
                  if (item === 'Home') return scrollToSection('top');
                  if (item === 'Routes') return scrollToSection('routes');
                  if (item === 'My Bookings') return openMyBookings();
                  if (item === 'Contact') return scrollToSection('contact');
                }}
                className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
                {item}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            {userEmail ? (
              <>
                <button
                  onClick={openMyBookings}
                  className="text-sm font-semibold text-muted-foreground px-4 py-2 rounded-xl hover:bg-muted/70 hover:text-primary transition-all"
                >
                  My Trips
                </button>
                <button
                  onClick={onLogout}
                  className="text-sm font-semibold text-muted-foreground border border-border px-4 py-2 rounded-xl hover:border-destructive/30 hover:text-destructive transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onNavigate("login")}
                  className="text-sm font-semibold text-muted-foreground border border-border px-4 py-2 rounded-xl hover:border-primary/30 hover:text-primary transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => onNavigate("register")}
                  className="text-sm font-semibold text-muted-foreground border border-border px-4 py-2 rounded-xl hover:border-primary/30 hover:text-primary transition-all"
                >
                  Register
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-border px-4 py-4 space-y-3">
            {["Home", "Routes", "My Bookings", "Contact"].map(item => (
              <button
                key={item}
                onClick={() => {
                  if (item === 'Home') return scrollToSection('top');
                  if (item === 'Routes') return scrollToSection('routes');
                  if (item === 'My Bookings') return openMyBookings();
                  if (item === 'Contact') return scrollToSection('contact');
                }}
                className="block w-full text-left text-sm font-semibold text-foreground py-2"
              >
                {item}
              </button>
            ))}
            <div className="pt-2 space-y-2">
              {userEmail ? (
                <>
                  <button onClick={openMyBookings} className="w-full border border-border text-sm font-bold py-3 rounded-xl">My Trips</button>
                  <button onClick={onLogout} className="w-full border border-border text-sm font-bold py-3 rounded-xl text-destructive">Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => onNavigate("login")} className="w-full border border-border text-sm font-bold py-3 rounded-xl">Login</button>
                  <button onClick={() => onNavigate("register")} className="w-full border border-border text-sm font-bold py-3 rounded-xl">Register</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <section className="relative min-h-[100dvh] flex items-center pt-16 overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 bg-slate-900">
          <img
            src="https://images.unsplash.com/photo-1745438032897-f5b5ad5e2ce0?w=1400&h=900&fit=crop&auto=format"
            alt="Njoroline bus on Kenyan highway"
            className="w-full h-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0D2B5E]/80 via-[#1565C0]/40 to-[#0D1B3E]/80" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-semibold">Nakuru - Njoro - Kisumu</span>
            </div>

            <h1 className="text-white text-5xl sm:text-6xl font-extrabold leading-[1.05] mb-5 tracking-tight">
              Book Your Journey<br />with <span style={{ color: "#00C853" }}>Njoroline</span>
            </h1>
            <p className="text-white/70 text-lg sm:text-xl font-medium mb-10 leading-relaxed">
              Fast - Reliable - Comfortable Travel<br className="sm:hidden" />
              <span className="hidden sm:inline"> - Connecting Nakuru, Njoro and Kisumu.</span>
            </p>

            {/* Search widget */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-5 sm:p-6 max-w-xl">
              <p className="text-foreground font-bold text-sm mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Find Available Trips
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* From */}
                <div className="relative">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1 block">From</label>
                  <button
                    onClick={() => { setShowFromDrop(!showFromDrop); setShowToDrop(false); }}
                    className="w-full flex items-center gap-2 bg-muted rounded-xl px-3 py-3 text-left"
                  >
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground font-semibold text-sm flex-1 truncate">{from}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${showFromDrop ? "rotate-180" : ""}`} />
                  </button>
                  {showFromDrop && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border border-border shadow-xl z-20">
                      {locationOptions.filter(l => l !== to).map(loc => (
                        <button key={loc} onClick={() => { setFrom(loc); setShowFromDrop(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-border/40 last:border-0">
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* To */}
                <div className="relative">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1 block">To</label>
                  <button
                    onClick={() => { setShowToDrop(!showToDrop); setShowFromDrop(false); }}
                    className="w-full flex items-center gap-2 bg-muted rounded-xl px-3 py-3 text-left"
                  >
                    <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-foreground font-semibold text-sm flex-1 truncate">{to}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${showToDrop ? "rotate-180" : ""}`} />
                  </button>
                  {showToDrop && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border border-border shadow-xl z-20">
                      {locationOptions.filter(l => l !== from).map(loc => (
                        <button key={loc} onClick={() => { setTo(loc); setShowToDrop(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl border-b border-border/40 last:border-0">
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Date */}
                <div>
                  <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1 block">Date</label>
                  <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-3">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="bg-transparent text-foreground text-xs font-semibold flex-1 outline-none cursor-pointer min-w-0" />
                  </div>
                </div>
              </div>

              <button onClick={handleSearch}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">
                <Search className="w-5 h-5" />
                Search Trips
              </button>
            </div>
          </div>
        </div>
      </section>      <section className="bg-primary py-8">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {routeStats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-white font-extrabold text-3xl mb-1">{s.value}</p>
              <p className="text-white/60 text-sm font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>      <section ref={routesRef} className="py-16 px-4 sm:px-6 max-w-7xl mx-auto scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-primary text-sm font-bold uppercase tracking-widest mb-2">Available Routes</p>
            <h2 className="text-foreground text-3xl font-extrabold">Scheduled for {date}</h2>
          </div>
          {routesError && (
            <p className="text-sm text-muted-foreground max-w-md">
              Route totals are unavailable right now. You can still search using the listed towns.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {displayedRoutes.map(route => (
            <button
              key={route.key}
              onClick={() => handleRoute(route)}
              className="bg-card rounded-2xl border border-border p-5 text-left hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Bus className="w-5 h-5 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-foreground font-extrabold text-lg mb-1">{route.from} to {route.to}</p>
              <p className="text-muted-foreground text-sm mb-4">
                {route.tripCount === null ? "Search to confirm scheduled trips" : `${route.tripCount} scheduled trip${route.tripCount === 1 ? "" : "s"}`}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Fare</p>
                  <p className="text-foreground font-bold">{route.fare === null ? "Per trip" : `KES ${route.fare}`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Seats</p>
                  <p className="text-foreground font-bold">{route.seatsAvailable === null ? "Check" : route.seatsAvailable}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-bold uppercase tracking-widest mb-2">Why Choose Njoroline</p>
          <h2 className="text-foreground text-3xl sm:text-4xl font-extrabold">Travel Made Effortless</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card rounded-3xl border border-border p-6 hover:shadow-md hover:border-primary/20 transition-all group">
              <div className="w-12 h-12 bg-primary/8 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-foreground font-bold text-base mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-bold uppercase tracking-widest mb-2">Simple Process</p>
          <h2 className="text-foreground text-3xl font-extrabold">Book in 3 Easy Steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.step} className="relative text-center">
              <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/25">
                <span className="text-white font-extrabold text-xl">{step.step}</span>
              </div>
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-border" />
              )}
              <h3 className="text-foreground font-bold text-lg mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#0D2B5E] to-[#1565C0] rounded-3xl p-10 text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-accent/10 rounded-full" />
          <div className="relative z-10">
            <h2 className="text-white text-3xl font-extrabold mb-3">Ready to Travel with Njoroline?</h2>
            <p className="text-white/60 text-base mb-8">Choose a scheduled route, reserve your seat, and pay with M-Pesa.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => startBooking()}
                className="bg-white text-primary font-extrabold px-8 py-4 rounded-2xl text-base hover:bg-white/90 transition-colors">
                Book Your Trip
              </button>
            </div>
          </div>
        </div>
      </section>      <footer className="bg-[#0D1B3E] text-white/70 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
                  <Bus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white font-extrabold text-lg">NJOROLINE</span>
                  <p className="text-white/40 text-[9px] font-bold tracking-widest uppercase">Operators</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4">Connecting passengers to scheduled trips across Nakuru, Njoro, and Kisumu.</p>
            </div>

            {/* Quick Links */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Quick Links</p>
              {["Book a Trip", "My Bookings", "Our Routes", "About Us", "Contact Us"].map(l => (
                <button
                  key={l}
                  onClick={() => {
                    if (l === 'Book a Trip') return startBooking();
                    if (l === 'My Bookings') return openMyBookings();
                    if (l === 'Our Routes') return scrollToSection('routes');
                    if (l === 'About Us') return scrollToSection('top');
                    if (l === 'Contact Us') return scrollToSection('contact');
                  }}
                  className="block text-sm py-1.5 hover:text-white transition-colors"
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Routes */}
            <div>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Our Routes</p>
              {displayedRoutes.map(r => (
                <button key={r.key} onClick={() => handleRoute(r)}
                  className="block text-sm py-1.5 hover:text-white transition-colors">
                  {r.from} to {r.to}  {r.fare === null ? " " : `- KES ${r.fare}`}
                </button>
              ))}
            </div>

            {/* Contact */}
            <div ref={contactRef}>
              <p className="text-white font-bold text-sm mb-4 uppercase tracking-widest">Contact</p>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm">Service available on the listed Nakuru, Njoro, and Kisumu routes.</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Customer Care</p>
                    <p className="text-sm">Use your booking phone number when requesting support.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Customer Care</p>
                    <p className="text-sm">support@njoroline.co.ke · +254 113 050 613</p>
                  </div>
                </div>
                <a
                  href={WHATSAPP_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Contact Njoroline support on WhatsApp"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#20BD5A]"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Support
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-white/40">(c) 2026 Njoroline Operators. All rights reserved.</p>
            <div className="flex gap-4">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(l => (
                <button key={l} className="text-xs text-white/40 hover:text-white/70 transition-colors">{l}</button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
