import { useState, lazy, Suspense } from "react";
import { LandingPage } from "./components/landing";
import { PassengerFlow, type PassengerScreen } from "./components/passenger-flow";
import { LoginPage } from "./components/login";
import { RegisterPage } from "./components/register";
import { ResetPasswordPage } from "./components/reset-password";
import { confirmPasswordReset, loginUser, logoutUser, registerUser, requestPasswordReset } from "../services/api";
const AdminDashboard = lazy(() => import("./components/admin-dashboard").then(m => ({ default: m.AdminDashboard })));

type AppMode = "landing" | "passenger" | "admin" | "login" | "register" | "reset-password";

const initialMode = (): AppMode => {
  if (window.location.pathname.startsWith("/reset-password")) return "reset-password";
  return "landing";
};

const getResetParams = () => {
  const cleanTokenPart = (value: string | null) => {
    if (!value) return "";
    try {
      value = decodeURIComponent(value);
    } catch {
      // Keep the original value if the browser already decoded it.
    }
    return value.replace(/=3D/gi, "").replace(/=/g, "").trim();
  };

  const params = new URLSearchParams(window.location.search);
  const queryUid = cleanTokenPart(params.get("uid"));
  const queryToken = cleanTokenPart(params.get("token"));
  if (queryUid && queryToken) return { uid: queryUid, token: queryToken };

  const [, resetPath, uid, token] = window.location.pathname.split("/");
  if (resetPath === "reset-password" && uid && token) {
    return { uid: cleanTokenPart(uid), token: cleanTokenPart(token) };
  }

  return { uid: "", token: "" };
};

export default function App() {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [bookingFrom, setBookingFrom] = useState("Nakuru");
  const [bookingTo, setBookingTo] = useState("Kisumu");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [initialPassengerScreen, setInitialPassengerScreen] = useState<PassengerScreen | undefined>(undefined);

  const handleNavigate = (newMode: AppMode, from?: string, to?: string, screen?: PassengerScreen, date?: string) => {
    if (from) setBookingFrom(from);
    if (to) setBookingTo(to);
    if (date) setBookingDate(date);
    setInitialPassengerScreen(screen);
    setMode(newMode);
  };

  const goHome = () => {
    if (window.location.pathname === "/reset-password") {
      window.history.replaceState({}, "", "/");
    }
    setMode("landing");
  };

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

  const handleLogout = async () => {
    await logoutUser();
    setUserEmail(null);
    setAdminLoggedIn(false);
    setMode("landing");
  };

  const handlePasswordResetRequest = async (email: string) => {
    const result = await requestPasswordReset(email);
    if (result.error) return result.error;
  };

  const handlePasswordResetConfirm = async (password: string, passwordConfirm: string) => {
    const { uid, token } = getResetParams();
    const result = await confirmPasswordReset(uid, token, password, passwordConfirm);
    if (result.error) return result.error;
    window.history.replaceState({}, "", "/login");
  };

  if (mode === "admin") {
    if (!adminLoggedIn) {
      return <LoginPage onBack={goHome} onLogin={handleUserLogin} onRegister={() => setMode("register")} onPasswordReset={handlePasswordResetRequest} />;
    }

    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading adminâ€¦</div>}>
        <AdminDashboard onBack={() => setMode("landing")} />
      </Suspense>
    );
  }

  if (mode === "passenger") {
    return (
      <PassengerFlow
        initialFrom={bookingFrom}
        initialTo={bookingTo}
        initialDate={bookingDate}
        initialScreen={initialPassengerScreen}
        onBack={() => setMode("landing")}
      />
    );
  }

  if (mode === "login") {
    return <LoginPage onBack={goHome} onLogin={handleUserLogin} onRegister={() => setMode("register")} onPasswordReset={handlePasswordResetRequest} />;
  }

  if (mode === "register") {
    return <RegisterPage onBack={goHome} onRegister={handleRegister} onLogin={() => setMode("login")} />;
  }

  if (mode === "reset-password") {
    const { uid, token } = getResetParams();
    return (
      <ResetPasswordPage
        uid={uid}
        token={token}
        onBack={goHome}
        onConfirm={handlePasswordResetConfirm}
        onLogin={() => setMode("login")}
      />
    );
  }

  return <LandingPage onNavigate={handleNavigate} userEmail={userEmail} onLogout={handleLogout} />;
}
