import { FormEvent, useState } from "react";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock } from "lucide-react";

interface ResetPasswordPageProps {
  uid: string;
  token: string;
  onBack: () => void;
  onConfirm: (password: string, passwordConfirm: string) => Promise<string | void>;
  onLogin: () => void;
}

export function ResetPasswordPage({ uid, token, onBack, onConfirm, onLogin }: ResetPasswordPageProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const invalidLink = !uid || !token;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (invalidLink) {
      setError("This reset link is invalid or incomplete.");
      return;
    }

    if (!password || !passwordConfirm) {
      setError("Enter and confirm your new password.");
      return;
    }

    setLoading(true);
    const result = await onConfirm(password, passwordConfirm);
    setLoading(false);

    if (result) setError(result);
    else setNotice("Password reset successful. You can now log in.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-card border border-border rounded-[32px] shadow-xl overflow-hidden">
        <div className="bg-primary/10 px-6 py-5 border-b border-border flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-white/90 text-primary rounded-2xl flex items-center justify-center hover:bg-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.24em] font-semibold">Account Recovery</p>
            <h1 className="text-2xl font-extrabold">Reset Password</h1>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <p className="text-sm text-muted-foreground">Choose a new password for your Njoroline account.</p>
          {error && <div className="rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm">{error}</div>}
          {notice && <div className="rounded-2xl bg-primary/10 text-primary px-4 py-3 text-sm">{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">New Password</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <Lock className="w-4 h-4 text-primary" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-muted-foreground hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Confirm Password</span>
              <div className="mt-2 flex items-center gap-3 bg-muted rounded-3xl px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-primary/30">
                <Lock className="w-4 h-4 text-primary" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-transparent outline-none text-sm font-medium text-foreground"
                />
              </div>
            </label>

            <button type="submit" disabled={loading || Boolean(notice)} className="w-full bg-primary text-primary-foreground font-bold rounded-3xl py-4 text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? "Resetting..." : "Reset Password"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Remembered it? <button onClick={onLogin} type="button" className="font-semibold text-primary hover:text-primary/80 transition-colors">Back to login</button>
          </div>
        </div>
      </div>
    </div>
  );
}
