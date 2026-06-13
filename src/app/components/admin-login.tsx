import { FormEvent, useState } from "react";
import { ArrowRight, ChevronLeft, Lock, User } from "lucide-react";

interface AdminLoginProps {
  onBack: () => void;
  onAdminLogin: () => void;
}

export function AdminLogin({ onBack, onAdminLogin }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setError("");
    onAdminLogin();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-card border border-border rounded-[32px] shadow-xl overflow-hidden">
        <div className="bg-primary/10 px-6 py-5 border-b border-border flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/90 text-primary rounded-2xl flex items-center justify-center hover:bg-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] font-semibold">Admin Access</p>
            <h1 className="text-2xl font-extrabold">Admin Login</h1>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sign in with your admin credentials to manage bookings, routes, and drivers.</p>
            {error && <div className="rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm">{error}</div>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Username</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <User className="w-4 h-4 text-primary" />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Password</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <Lock className="w-4 h-4 text-primary" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
              </div>
            </label>

            <button type="submit" className="w-full bg-primary text-primary-foreground font-bold rounded-3xl py-4 text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              Access Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
