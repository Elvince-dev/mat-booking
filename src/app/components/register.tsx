import { FormEvent, useState } from "react";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

interface RegisterPageProps {
  onBack: () => void;
  onRegister: (name: string, email: string, password: string) => Promise<string | void>;
  onLogin: () => void;
}

export function RegisterPage({ onBack, onRegister, onLogin }: RegisterPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await onRegister(name.trim(), email.trim(), password);
    setLoading(false);
    if (result) setError(result);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-card border border-border rounded-[32px] shadow-xl overflow-hidden">
        <div className="bg-primary/10 px-6 py-5 border-b border-border flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/90 text-primary rounded-2xl flex items-center justify-center hover:bg-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] font-semibold">Create Account</p>
            <h1 className="text-2xl font-extrabold">Register Passenger</h1>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Set up your account and start booking with Njoroline.</p>
            {error && <div className="rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm">{error}</div>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Full Name</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <User className="w-4 h-4 text-primary" />
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jane Mwangi"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Email</span>
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
                  placeholder="Choose a password"
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

            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground font-bold rounded-3xl py-4 text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? "Creating Account..." : "Create Account"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account? <button onClick={onLogin} type="button" className="font-semibold text-primary hover:text-primary/80 transition-colors">Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}
