import { useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

type Mode = "in" | "up";

export function AuthPanel() {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const ar = lang === "ar";
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<"in" | "up" | "guest" | null>(null);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setErr(null);
  };

  const submit = async () => {
    setErr(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErr(ar ? "أدخل بريداً صحيحاّ وكلمة مرور من 6 أحرف على الأقل." : "Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setLoading(mode);
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword(parsed.data)
      : await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: window.location.origin } });
    setLoading(null);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login")) setErr(ar ? "البريد أو كلمة المرور غير صحيحة." : "Invalid email or password.");
      else if (msg.includes("already registered")) {
        setMode("in");
        setErr(ar ? "هذا البريد مسجّل بالفعل. سجّل الدخول." : "This email is already registered. Please sign in.");
      }
      else setErr(error.message);
      return;
    }
    if (data.session) {
      window.location.assign("/chat");
      return;
    }
    setErr(ar
      ? "تم إنشاء الحساب. افتح بريدك للتأكيد ثم سجّل الدخول."
      : "Account created. Open your email to confirm it, then sign in.");
  };

  const guest = async () => {
    setErr(null); setLoading("guest");
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(null);
    if (error) { setErr(error.message); return; }
    window.location.assign("/chat");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur">
      <div role="group" aria-label={ar ? "وضع تسجيل الدخول" : "Authentication mode"} className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
        {(["in", "up"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => switchMode(m)}
              className={
                "h-11 rounded-lg text-base font-semibold transition-colors " +
                (active
                  ? "bg-secondary text-secondary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {m === "in" ? (ar ? "تسجيل الدخول" : "Sign In") : (ar ? "إنشاء حساب" : "Create Account")}
            </button>
          );
        })}
      </div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={ar ? "البريد الإلكتروني" : "Email"} className="h-12 text-base" />
        <div className="relative">
          <Input type={showPassword ? "text" : "password"} autoComplete={mode === "in" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={ar ? "كلمة المرور" : "Password"} className="h-12 pe-12 text-base" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? (ar ? "إخفاء كلمة المرور" : "Hide password") : (ar ? "إظهار كلمة المرور" : "Show password")} aria-pressed={showPassword}
            className="absolute inset-y-0 end-1 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        <Button type="submit" size="lg" variant="secondary" disabled={loading !== null} className="h-14 w-full text-base font-semibold">
          {loading === mode ? "…" : mode === "in" ? (ar ? "تسجيل الدخول" : "Sign In") : (ar ? "إنشاء حساب" : "Create Account")}
        </Button>
      </form>
      <Button type="button" size="lg" variant="outline" disabled={loading !== null} onClick={guest} className="h-12 w-full text-base font-semibold">
        {loading === "guest" ? "…" : t.signInGuest}
      </Button>
      {err && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {err}
        </p>
      )}
    </div>
  );
}
