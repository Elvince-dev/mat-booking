import { useState, lazy, Suspense } from "react";
import { LandingPage } from "./components/landing";
import { PassengerFlow, type PassengerScreen } from "./components/passenger-flow";
import { LoginPage } from "./components/login";
import { RegisterPage } from "./components/register";
<<<<<<< HEAD
import { loginUser, logoutUser, registerUser } from "../services/api";
=======
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
const AdminDashboard = lazy(() => import("./components/admin-dashboard").then(m => ({ default: m.AdminDashboard })));

type AppMode = "landing" | "passenger" | "admin" | "login" | "register";

export default function App() {
  const [mode, setMode] = useState<AppMode>("landing");
  const [bookingFrom, setBookingFrom] = useState("Nakuru");
  const [bookingTo, setBookingTo] = useState("Kisumu");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [initialPassengerScreen, setInitialPassengerScreen] = useState<PassengerScreen | undefined>(undefined);

<<<<<<< HEAD
  const handleNavigate = (newMode: AppMode, from?: string, to?: string, screen?: PassengerScreen, date?: string) => {
    if (from) setBookingFrom(from);
    if (to) setBookingTo(to);
    if (date) setBookingDate(date);
=======
  const handleNavigate = (newMode: AppMode, from?: string, to?: string, screen?: PassengerScreen) => {
    if (from) setBookingFrom(from);
    if (to) setBookingTo(to);
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
    setInitialPassengerScreen(screen);
    setMode(newMode);
  };

<<<<<<< HEAD
  const handleUserLogin = async (username: string, password: string) => {
    const result = await loginUser(username, password);
    if (result.error || !result.data) {
      return result.error || "Login failed. Check your username and password.";
    }

    const { user } = result.data;
    setUserEmail(user.email || user.username);
    if (user.is_staff || user.is_superuser) {
      setAdminLoggedIn(true);
      setMode("admin");
    } else {
      setAdminLoggedIn(false);
      setMode("landing");
    }
=======
  const handleUserLogin = (email: string, password: string) => {
    const adminEmail = "elvinceadmin@gmail.com";
    const adminPassword = "@elvinceAdmin1";

    if (email === adminEmail && password === adminPassword) {
      setAdminLoggedIn(true);
      setMode("admin");
      return;
    }

    setUserEmail(email);
    setMode("landing");
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const username = email.trim().toLowerCase();
    const result = await registerUser({
      username,
      email: username,
      password,
      password_confirm: password,
      first_name: firstName || "",
      last_name: rest.join(" "),
    });
    if (result.error || !result.data) {
      return result.error || "Registration failed. Please try again.";
    }

    setUserEmail(null);
    setAdminLoggedIn(false);
    setMode("login");
  };

<<<<<<< HEAD
  const handleLogout = async () => {
    await logoutUser();
    setUserEmail(null);
    setAdminLoggedIn(false);
    setMode("landing");
  };

=======
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
  if (mode === "admin") {
    if (!adminLoggedIn) {
      return <LoginPage onBack={() => setMode("landing")} onLogin={handleUserLogin} onRegister={() => setMode("register")} />;
    }

    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading admin…</div>}>
        <AdminDashboard onBack={() => setMode("landing")} />
      </Suspense>
    );
  }

  if (mode === "passenger") {
    return (
      <PassengerFlow
        initialFrom={bookingFrom}
        initialTo={bookingTo}
<<<<<<< HEAD
        initialDate={bookingDate}
=======
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
        initialScreen={initialPassengerScreen}
        onBack={() => setMode("landing")}
      />
    );
  }

  if (mode === "login") {
    return <LoginPage onBack={() => setMode("landing")} onLogin={handleUserLogin} onRegister={() => setMode("register")} />;
  }

  if (mode === "register") {
    return <RegisterPage onBack={() => setMode("landing")} onRegister={handleRegister} onLogin={() => setMode("login")} />;
  }

  return <LandingPage onNavigate={handleNavigate} userEmail={userEmail} onLogout={handleLogout} />;
}
