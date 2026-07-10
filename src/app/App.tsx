import { useState, lazy, Suspense } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { LandingPage } from "./components/landing";
import { PassengerFlow, type PassengerScreen } from "./components/passenger-flow";
import { LoginPage } from "./components/login";
import { RegisterPage } from "./components/register";
import { ResetPasswordPage } from "./components/reset-password";
import { confirmPasswordReset, loginUser, logoutUser, registerUser, requestPasswordReset } from "../services/api";

const AdminDashboard = lazy(() => import("./components/admin-dashboard").then(m => ({ default: m.AdminDashboard })));

type AppMode = "landing" | "passenger" | "admin" | "login" | "register" | "reset-password";

const getRouteForMode = (mode: AppMode) => {
  switch (mode) {
    case "admin":
      return "/admin";
    case "login":
      return "/login";
    case "register":
      return "/register";
    case "reset-password":
      return "/reset-password";
    case "passenger":
      return "/booking";
    default:
      return "/";
  }
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
  const navigate = useNavigate();
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
    navigate(getRouteForMode(newMode));
  };

  const goHome = () => {
    navigate("/", { replace: true });
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
      navigate("/admin");
    } else {
      setAdminLoggedIn(false);
      navigate("/");
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
    navigate("/login");
  };

  const handleLogout = async () => {
    await logoutUser();
    setUserEmail(null);
    setAdminLoggedIn(false);
    navigate("/");
  };

  const handlePasswordResetRequest = async (email: string) => {
    const result = await requestPasswordReset(email);
    if (result.error) return result.error;
  };

  const handlePasswordResetConfirm = async (password: string, passwordConfirm: string) => {
    const { uid, token } = getResetParams();
    const result = await confirmPasswordReset(uid, token, password, passwordConfirm);
    if (result.error) return result.error;
    navigate("/login", { replace: true });
  };

  const resetParams = getResetParams();

  return (
    <Routes>
      <Route path="/" element={<LandingPage onNavigate={handleNavigate} userEmail={userEmail} onLogout={handleLogout} />} />
      <Route path="/login" element={<LoginPage onBack={goHome} onLogin={handleUserLogin} onRegister={() => navigate("/register")} onPasswordReset={handlePasswordResetRequest} />} />
      <Route path="/register" element={<RegisterPage onBack={goHome} onRegister={handleRegister} onLogin={() => navigate("/login")} />} />
      <Route
        path="/booking"
        element={
          <PassengerFlow
            initialFrom={bookingFrom}
            initialTo={bookingTo}
            initialDate={bookingDate}
            initialScreen={initialPassengerScreen}
            onBack={() => navigate("/")}
          />
        }
      />
      <Route
        path="/admin"
        element={
          adminLoggedIn ? (
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading admin</div>}>
              <AdminDashboard onBack={() => navigate("/")} />
            </Suspense>
          ) : (
            <LoginPage onBack={goHome} onLogin={handleUserLogin} onRegister={() => navigate("/register")} onPasswordReset={handlePasswordResetRequest} />
          )
        }
      />
      <Route
        path="/reset-password"
        element={
          <ResetPasswordPage
            uid={resetParams.uid}
            token={resetParams.token}
            onBack={goHome}
            onConfirm={handlePasswordResetConfirm}
            onLogin={() => navigate("/login")}
          />
        }
      />
      <Route
        path="/reset-password/:uid/:token"
        element={
          <ResetPasswordPage
            uid={resetParams.uid}
            token={resetParams.token}
            onBack={goHome}
            onConfirm={handlePasswordResetConfirm}
            onLogin={() => navigate("/login")}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
