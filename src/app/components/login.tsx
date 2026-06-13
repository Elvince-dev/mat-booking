import { FormEvent, useState } from "react";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";

interface LoginPageProps {
  onBack: () => void;
<<<<<<< HEAD
  onLogin: (username: string, password: string) => Promise<string | void>;
=======
  onLogin: (email: string, password: string) => void;
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
  onRegister: () => void;
}

export function LoginPage({ onBack, onLogin, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Username/email and password are required.");
      return;
    }
    setError("");
<<<<<<< HEAD
    setLoading(true);
    const result = await onLogin(email.trim(), password);
    setLoading(false);
    if (result) setError(result);
  };

  const handleForgotPassword = () => {
    setError("");
    const account = email.trim();
    if (!account) {
      setRecoveryNotice("Enter your email or username first, then contact support to reset your password.");
      return;
    }
    setRecoveryNotice(`Password reset is not automated yet. Contact support and share this account: ${account}.`);
=======
    onLogin(email.trim(), password);
>>>>>>> e7d15adab916977681cad1d43ad818a29ec9dfeb
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-card border border-border rounded-[32px] shadow-xl overflow-hidden">
        <div className="bg-primary/10 px-6 py-5 border-b border-border flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/90 text-primary rounded-2xl flex items-center justify-center hover:bg-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] font-semibold">Welcome Back</p>
            <h1 className="text-2xl font-extrabold">Passenger Login</h1>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sign in to continue booking your ride with Njoroline.</p>
            {error && <div className="rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm">{error}</div>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Username or Email</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <Mail className="w-4 h-4 text-primary" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Password</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <Lock className="w-4 h-4 text-primary" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {recoveryNotice && (
              <div className="rounded-2xl bg-primary/10 text-primary px-4 py-3 text-sm">
                {recoveryNotice}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold rounded-3xl py-4 text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? "Signing in..." : "Continue to Booking"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don’t have an account? <button onClick={onRegister} type="button" className="font-semibold text-primary hover:text-primary/80 transition-colors">Create one</button>
          </div>
        </div>
      </div>
    </div>
  );
}
