import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3, Bus, Calendar, Check, Download, LayoutDashboard, LogOut,
  Map, RefreshCw, Search, Ticket, Users, Wallet, X, Menu,
} from "lucide-react";
import {
  createAdminBus,
  createAdminRoute,
  createAdminTrip,
  deleteAdminRoute,
  getAdminPortalData,
  updateAdminBooking,
  updateAdminBus,
  updateAdminRoute,
  updateAdminTrip,
  type AdminPortalData,
} from "../../services/api";
import { useIsMobile } from "./ui/use-mobile";

type AdminSection = "dashboard" | "vehicles" | "routes" | "trips" | "bookings" | "payments" | "passengers";

interface AdminDashboardProps {
  onBack: () => void;
}

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", Icon: LayoutDashboard },
  { id: "vehicles" as const, label: "Vehicles", Icon: Bus },
  { id: "routes" as const, label: "Routes", Icon: Map },
  { id: "trips" as const, label: "Trips", Icon: Calendar },
  { id: "bookings" as const, label: "Bookings", Icon: Ticket },
  { id: "payments" as const, label: "Payments", Icon: Wallet },
  { id: "passengers" as const, label: "Passengers", Icon: Users },
];

const statusBadge = (status: string) => {
  const normalized = status.replace("_", " ");
  const cls = {
    confirmed: "bg-green-50 text-green-700 border-green-200",
    SUCCESS: "bg-green-50 text-green-700 border-green-200",
    pending_payment: "bg-yellow-50 text-yellow-700 border-yellow-200",
    PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
    payment_failed: "bg-red-50 text-red-700 border-red-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
  }[status] || "bg-slate-100 text-slate-600 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${cls}`}>{normalized}</span>;
};

function money(value: number | string | null | undefined) {
  return `KES ${Number(value ?? 0).toLocaleString()}`;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString();
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(header => JSON.stringify(row[header] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function Stat({ label, value, Icon }: { label: string; value: string | number; Icon: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl sm:text-2xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function AdminShell({ current, onChange, onBack, children }: {
  current: AdminSection;
  onChange: (section: AdminSection) => void;
  onBack: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7FB]">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50 rounded-lg bg-[#0D1B3E] p-2 text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Sidebar with overlay on mobile */}
      {(!isMobile || sidebarOpen) && (
        <>
          {isMobile && (
            <div
              className="fixed inset-0 z-30 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside className={`${
            isMobile ? "fixed left-0 top-0 h-screen w-60 z-40" : "relative w-60 flex-shrink-0"
          } flex flex-col bg-[#0D1B3E]`}>
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary flex-shrink-0">
                  <Bus className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-white truncate">NJOROLINE</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 truncate">Admin Portal</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => {
                    onChange(id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors min-w-0 ${
                    current === id ? "bg-primary text-white" : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-white/10 p-3">
              <button onClick={onBack} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/55 hover:bg-red-500/10 hover:text-red-300 min-w-0">
                <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="truncate">Exit Admin</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 sm:pt-0">
        {children}
      </main>
    </div>
  );
}

function Toolbar({ title, subtitle, onRefresh, action }: {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex flex-col gap-2 sm:gap-3 border-b border-border bg-white px-4 py-2 sm:py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg sm:text-xl font-extrabold text-foreground">{title}</h1>
        {subtitle && <p className="truncate text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-shrink-0 gap-2">
        {action}
        <button onClick={onRefresh} className="flex items-center gap-1 sm:gap-2 whitespace-nowrap rounded-xl border border-border px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold text-foreground hover:border-primary/30 hover:[...]
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}

type BusRow = AdminPortalData["buses"][number];
type RouteRow = AdminPortalData["routes"][number];
type TripRow = AdminPortalData["trips"][number];

function VehicleForm({ editing, onDone, onCancel }: { editing: BusRow | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ plate_number: "", capacity: "14", vehicle_type: "matatu", driver_name: "" });
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (editing) {
      setForm({
        plate_number: editing.plate_number,
        capacity: String(editing.capacity),
        vehicle_type: editing.vehicle_type,
        driver_name: editing.driver_name || "",
      });
    } else {
      setForm({ plate_number: "", capacity: "14", vehicle_type: "matatu", driver_name: "" });
    }
    setError("");
  }, [editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, capacity: Number(form.capacity), is_active: true };
    const result = editing ? await updateAdminBus(editing.id, payload) : await createAdminBus(payload);
    if (result.error) return setError(result.error);
    setForm({ plate_number: "", capacity: "14", vehicle_type: "matatu", driver_name: "" });
    setError("");
    onDone();
  };

  return (
    <form onSubmit={submit} className={`grid gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 ${
      isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    }`}>
      <input required placeholder="Plate number" value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} className="rounded-lg border border-border bg-muted p[...]
      <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none">
        <option value="matatu">Matatu</option>
        <option value="minibus">Mini-bus</option>
        <option value="coach">Coach</option>
      </select>
      <input required type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="rounded-lg border border-border [...]
      <input placeholder="Driver name" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 tex[...]
      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white">{editing ? "Save Vehicle" : "Add Vehicle"}</button>
        {editing && <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Cancel</button>}
      </div>
      {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

function RouteForm({ editing, onDone, onCancel }: { editing: RouteRow | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ origin: "", destination: "" });
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (editing) {
      setForm({ origin: editing.origin, destination: editing.destination });
    } else {
      setForm({ origin: "", destination: "" });
    }
    setError("");
  }, [editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = editing ? await updateAdminRoute(editing.id, form) : await createAdminRoute(form);
    if (result.error) return setError(result.error);
    setForm({ origin: "", destination: "" });
    setError("");
    onDone();
  };

  return (
    <form onSubmit={submit} className={`grid gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 ${
      isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"
    }`}>
      <input required placeholder="Origin" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm o[...]
      <input required placeholder="Destination" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} className="rounded-lg border border-border bg-muted px-3[...]
      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white">{editing ? "Save Route" : "Add Route"}</button>
        {editing && <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Cancel</button>}
      </div>
      {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

function TripForm({ data, editing, onDone, onCancel }: { data: AdminPortalData; editing: TripRow | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ route_id: "", bus_id: "", date: "", departure_time: "", arrival_time: "", fare: "" });
  const [error, setError] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (editing) {
      setForm({
        route_id: String(editing.route_id),
        bus_id: String(editing.bus_id),
        date: editing.date,
        departure_time: editing.departure_time.slice(0, 5),
        arrival_time: editing.arrival_time.slice(0, 5),
        fare: String(editing.fare),
      });
    } else {
      setForm({ route_id: "", bus_id: "", date: "", departure_time: "", arrival_time: "", fare: "" });
    }
    setError("");
  }, [editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, fare: Number(form.fare) };
    const result = editing ? await updateAdminTrip(editing.id, payload) : await createAdminTrip(payload);
    if (result.error) return setError(result.error);
    setForm({ route_id: "", bus_id: "", date: "", departure_time: "", arrival_time: "", fare: "" });
    setError("");
    onDone();
  };

  return (
    <form onSubmit={submit} className={`grid gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 ${
      isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6"
    }`}>
      <select required value={form.route_id} onChange={e => setForm({ ...form, route_id: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none">
        <option value="">Route</option>
        {data.routes.map(route => <option key={route.id} value={route.id}>{route.origin} to {route.destination}</option>)}
      </select>
      <select required value={form.bus_id} onChange={e => setForm({ ...form, bus_id: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none">
        <option value="">Vehicle</option>
        {data.buses.map(bus => <option key={bus.id} value={bus.id}>{bus.plate_number}</option>)}
      </select>
      <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none" [...]
      <input required type="time" value={form.departure_time} onChange={e => setForm({ ...form, departure_time: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 te[...]
      <input required type="time" value={form.arrival_time} onChange={e => setForm({ ...form, arrival_time: e.target.value })} className="rounded-lg border border-border bg-muted px-3 py-2 text-s[...]
      <input required type="number" min="1" placeholder="Fare" value={form.fare} onChange={e => setForm({ ...form, fare: e.target.value })} className="rounded-lg border border-border bg-muted px-[...]
      <div className={`flex gap-2 ${isMobile ? "col-span-1" : "col-span-full sm:col-span-1 lg:col-span-6"}`}>
        <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white">{editing ? "Save Trip" : "Add Trip"}</button>
        {editing && <button type="button" onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Cancel</button>}
      </div>
      {error && <p className="col-span-full text-sm text-destructive">{error}</p>}
    </form>
  );
}

// Mobile-friendly table wrapper
function ResponsiveTable({ children, isMobile }: { children: ReactNode; isMobile: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm ${isMobile ? "overflow-x-auto" : ""}`}>
      {children}
    </div>
  );
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [data, setData] = useState<AdminPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingBus, setEditingBus] = useState<BusRow | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRow | null>(null);
  const [editingTrip, setEditingTrip] = useState<TripRow | null>(null);
  const isMobile = useIsMobile();

  const loadData = async () => {
    setLoading(true);
    const result = await getAdminPortalData();
    if (result.error) setError(result.error);
    if (result.data) {
      setData(result.data);
      setError("");
      setEditingBus(null);
      setEditingRoute(null);
      setEditingTrip(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBookings = useMemo(() => {
    if (!data) return [];
    const query = search.toLowerCase();
    return data.bookings.filter(booking =>
      booking.passenger_name.toLowerCase().includes(query) ||
      booking.phone_number.includes(query) ||
      (booking.reference || "").toLowerCase().includes(query) ||
      booking.route.toLowerCase().includes(query)
    );
  }, [data, search]);

  const actionBooking = async (bookingId: number, action: "confirm" | "cancel") => {
    const result = await updateAdminBooking(bookingId, action);
    if (result.error) return setError(result.error);
    await loadData();
  };

  const deleteRoute = async (route: RouteRow) => {
    const confirmed = window.confirm(`Delete route "${route.name}"? This will also remove its trips and bookings.`);
    if (!confirmed) return;

    const result = await deleteAdminRoute(route.id);
    if (result.error) return setError(result.error);
    await loadData();
  };

  const content = () => {
    if (loading) return <div className="p-4 text-sm text-muted-foreground sm:p-6 lg:p-8">Loading admin data...</div>;
    if (!data) return <div className="p-4 text-sm text-destructive sm:p-6 lg:p-8">{error || "Admin data unavailable"}</div>;

    if (section === "dashboard") {
      const revenue = data.payments.filter(p => p.status === "SUCCESS").reduce((sum, item) => sum + Number(item.amount), 0);
      return (
        <>
          <Toolbar title="Dashboard" subtitle="Live operations summary" onRefresh={loadData} />
          <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Bookings" value={data.bookings.length} Icon={Ticket} />
              <Stat label="Passengers" value={data.passengers.length} Icon={Users} />
              <Stat label="Vehicles" value={data.buses.length} Icon={Bus} />
              <Stat label="Revenue" value={money(revenue)} Icon={Wallet} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
              <RecentBookings bookings={data.bookings.slice(0, 8)} />
              <RecentPayments payments={data.payments.slice(0, 8)} />
            </div>
          </div>
        </>
      );
    }

    if (section === "vehicles") {
      return (
        <>
          <Toolbar title="Vehicles" subtitle={`${data.buses.length} vehicles registered`} onRefresh={loadData} />
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6">
            <VehicleForm editing={editingBus} onDone={loadData} onCancel={() => setEditingBus(null)} />
            <ResponsiveTable isMobile={isMobile}>
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile 
                      ? ["Plate", "Type", "Capacity", "Status"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foregrou[...]
                      : ["Plate", "Type", "Capacity", "Driver", "Trips", "Status", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foregrou[...]
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.buses.map(bus => (
                    <tr key={bus.id} className="border-t border-border">
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{bus.plate_number}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 capitalize text-xs sm:text-sm">{bus.vehicle_type}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{bus.capacity}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{bus.driver_name || "-"}</td>}
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{bus.trips_count}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3">{bus.is_active ? statusBadge("confirmed") : statusBadge("cancelled")}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3"><button onClick={() => setEditingBus(bus)} className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold hover:border-primary/40 hover:t[...]
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </>
      );
    }

    if (section === "routes") {
      return (
        <>
          <Toolbar title="Routes" subtitle={`${data.routes.length} routes`} onRefresh={loadData} />
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6">
            <RouteForm editing={editingRoute} onDone={loadData} onCancel={() => setEditingRoute(null)} />
            <ResponsiveTable isMobile={isMobile}>
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile
                      ? ["Origin", "Destination", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                      : ["Name", "Origin", "Destination", "Trips", "Bookings", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.routes.map(route => (
                    <tr key={route.id} className="border-t border-border">
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{route.name}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{route.origin}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{route.destination}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{route.trips_count}</td>}
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{route.bookings_count}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setEditingRoute(route)} className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold hover:border-primary/40 hover:text-primary">Edit</button>
                          <button onClick={() => deleteRoute(route)} className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-red-600 hover:border-red-300 hover:bg-red-50">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </>
      );
    }

    if (section === "trips") {
      return (
        <>
          <Toolbar title="Trips" subtitle={`${data.trips.length} scheduled trips`} onRefresh={loadData} />
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6">
            <TripForm data={data} editing={editingTrip} onDone={loadData} onCancel={() => setEditingTrip(null)} />
            <ResponsiveTable isMobile={isMobile}>
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile
                      ? ["Route", "Date", "Fare", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                      : ["Date", "Route", "Vehicle", "Time", "Fare", "Seats", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.trips.map(trip => (
                    <tr key={trip.id} className="border-t border-border">
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{trip.date}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-xs sm:text-sm">{trip.route}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{trip.bus}</td>}
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{trip.departure_time.slice(0, 5)} - {trip.arrival_time.slice(0, 5)}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{money(trip.fare)}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{trip.booked_seats}/{trip.capacity} booked</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3"><button onClick={() => setEditingTrip(trip)} className="rounded-lg border border-border px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold hover:border-primary/40 hover[...]
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </>
      );
    }

    if (section === "bookings") {
      return (
        <>
          <Toolbar
            title="Bookings"
            subtitle={isMobile ? "Passenger details" : "Passenger details, seats, payment status, and ticket QR links"}
            onRefresh={loadData}
            action={<button onClick={() => downloadCsv("bookings.csv", data.bookings)} className="flex items-center gap-1 sm:gap-2 rounded-xl border border-border px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold"><Download className="h-4 w-4" />CSV</button>}
          />
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 lg:p-6">
            <SearchBox value={search} onChange={setSearch} placeholder={isMobile ? "Search..." : "Search passenger, phone, route, reference..."} />
            {isMobile ? (
              // Mobile card view
              <div className="space-y-3">
                {filteredBookings.length === 0 ? (
                  <EmptyState label="No bookings found" />
                ) : (
                  filteredBookings.map(booking => (
                    <div key={booking.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{booking.passenger_name}</p>
                          <p className="text-xs text-muted-foreground">{booking.phone_number}</p>
                        </div>
                        {statusBadge(booking.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Route</p>
                          <p className="font-semibold truncate">{booking.route}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Seat</p>
                          <p className="font-semibold">{booking.seat_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fare</p>
                          <p className="font-bold">{money(booking.fare)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment</p>
                          <p className="text-xs">{statusBadge(booking.payment_status || "PENDING")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <button title="Confirm" onClick={() => actionBooking(booking.id, "confirm")} className="flex-1 rounded-lg p-2 text-xs font-semibold text-green-700 hover:bg-green-50"><Check className="h-4 w-4 inline" /> Confirm</button>
                        <button title="Cancel" onClick={() => actionBooking(booking.id, "cancel")} className="flex-1 rounded-lg p-2 text-xs font-semibold text-red-700 hover:bg-red-50"><X className="h-4 w-4 inline" /> Cancel</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Desktop table view
              <ResponsiveTable isMobile={false}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/70">
                    <tr>
                      {["Reference", "Passenger", "Route", "Trip", "Seat", "Fare", "Payment", "Status", "QR", "Actions"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold u[...]
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(booking => (
                      <tr key={booking.id} className="border-t border-border align-top">
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs">{booking.reference || booking.id}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <p className="font-bold text-xs sm:text-sm">{booking.passenger_name}</p>
                          <p className="text-xs text-muted-foreground">{booking.phone_number}</p>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{booking.route}<br/><span className="text-xs text-muted-foreground">{booking.vehicle}</span></td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{booking.trip_date}<br/><span className="text-xs text-muted-foreground">{booking.departure_time.slice(0, 5)}</span></td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{booking.seat_number}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{money(booking.fare)}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs">{statusBadge(booking.payment_status || "PENDING")}<br/><span className="text-xs text-muted-foreground">{booking.mpesa_receipt || ""}</span></td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">{statusBadge(booking.status)}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">{booking.qr_code ? <a className="text-primary font-bold text-xs" href={booking.qr_code} target="_blank">Open</a> : "-"}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                          <div className="flex gap-1">
                            <button title="Confirm" onClick={() => actionBooking(booking.id, "confirm")} className="rounded-lg p-2 text-green-700 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                            <button title="Cancel" onClick={() => actionBooking(booking.id, "cancel")} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><X className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            )}
          </div>
        </>
      );
    }

    if (section === "payments") {
      return (
        <>
          <Toolbar title="Payments" subtitle={`${data.payments.length} M-Pesa records`} onRefresh={loadData} action={<button onClick={() => downloadCsv("payments.csv", data.payments)} className="flex items-center gap-1 sm:gap-2 rounded-xl border border-border px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold"><Download className="h-4 w-4" />CSV</button>} />
          <div className="p-3 sm:p-4 lg:p-6">
            <ResponsiveTable isMobile={isMobile}>
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile
                      ? ["Passenger", "Amount", "Status", "Created"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-f[...]
                      : ["Checkout", "Passenger", "Phone", "Amount", "Status", "Receipt", "Created"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-f[...]
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map(payment => (
                    <tr key={payment.id} className="border-t border-border">
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs">{payment.checkout_request_id}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{payment.passenger_name}<br/><span className="text-xs text-muted-foreground">{payment.booking_reference || payment.booking_id}</span></td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{payment.phone}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{money(payment.amount)}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs">{statusBadge(payment.status)}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs">{payment.mpesa_receipt || "-"}</td>}
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{dateTime(payment.created_at)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          </div>
        </>
      );
    }

    return (
      <>
        <Toolbar title="Passengers" subtitle={isMobile ? "Passenger contacts" : "Passenger contacts from bookings and registered users"} onRefresh={loadData} />
        <div className="grid grid-cols-1 gap-4 sm:gap-5 p-3 sm:p-4 lg:p-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-extrabold">Booking Passengers</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile
                      ? ["Name", "Phone", "Bookings"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                      : ["Name", "Phone", "Bookings", "Confirmed", "Last Booking"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.passengers.map(passenger => (
                    <tr key={passenger.phone_number} className="border-t border-border">
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{passenger.name}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{passenger.phone_number}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{passenger.bookings}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{passenger.confirmed_bookings}</td>}
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{dateTime(passenger.last_booking_at)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-extrabold">Registered Users</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/70">
                  <tr>
                    {isMobile
                      ? ["Name", "Role"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                      : ["Name", "Email", "Role", "Joined"].map(header => <th key={header} className="px-3 sm:px-4 py-2 sm:py-3 text-xs font-extrabold uppercase text-muted-foreground">{header}</th>)
                    }
                  </tr>
                </thead>
                <tbody>
                  {data.registered_users.map(user => (
                    <tr key={user.id} className="border-t border-border">
                      <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-xs sm:text-sm">{`${user.first_name} ${user.last_name}`.trim() || user.username}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{user.email || "-"}</td>}
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{user.is_staff ? "Admin" : "Passenger"}</td>
                      {!isMobile && <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">{dateTime(user.date_joined)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );
  };

  return (
    <AdminShell current={section} onChange={setSection} onBack={onBack}>
      {error && <div className="border-b border-red-200 bg-red-50 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-red-700">{error}</div>}
      {content()}
    </AdminShell>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none[...]
    </div>
  );
}

function RecentBookings({ bookings }: { bookings: AdminPortalData["bookings"] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold">Recent Bookings</h2>
      {bookings.length === 0 ? <EmptyState label="No bookings yet" /> : (
        <div className="space-y-2">
          {bookings.map(booking => (
            <div key={booking.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-bold">{booking.passenger_name}</p>
                <p className="truncate text-xs text-muted-foreground">{booking.route} · Seat {booking.seat_number}</p>
              </div>
              <div className="flex-shrink-0">
                {statusBadge(booking.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentPayments({ payments }: { payments: AdminPortalData["payments"] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold">Recent Payments</h2>
      {payments.length === 0 ? <EmptyState label="No payments yet" /> : (
        <div className="space-y-2">
          {payments.map(payment => (
            <div key={payment.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-bold">{payment.passenger_name}</p>
                <p className="truncate text-xs text-muted-foreground">{payment.phone} · {payment.mpesa_receipt || payment.checkout_request_id}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs sm:text-sm font-extrabold">{money(payment.amount)}</p>
                {statusBadge(payment.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
