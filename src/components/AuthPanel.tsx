import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

export function AuthPanel() {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<"in" | "up" | "guest" | null>(null);

  const submit = async (mode: "in" | "up") => {
    setErr(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErr(ar ? "أدخل بريداً صحيحاً وكلمة مرور من 6 أحرف على الأقل." : "Enter a valid email and a password of at least 6 characters.");
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
      else if (msg.includes("already registered")) setErr(ar ? "هذا البريد مسجّل بالفعل. سجّل الدخول." : "This email is already registered. Please sign in.");
      else setErr(error.message);
      return;
    }
    if (data.session) window.location.assign("/chat");
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
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit("in"); }}>
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={ar ? "البريد الإلكتروني" : "Email"} className="h-12 text-base" />
        <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder={ar ? "كلمة المرور" : "Password"} className="h-12 text-base" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" size="lg" variant="secondary" disabled={loading !== null} className="h-14 text-base font-semibold">
            {loading === "in" ? "…" : ar ? "تسجيل الدخول" : "Sign In"}
          </Button>
          <Button type="button" size="lg" variant="secondary" disabled={loading !== null} onClick={() => submit("up")} className="h-14 text-base font-semibold">
            {loading === "up" ? "…" : ar ? "إنشاء حساب" : "Sign Up"}
          </Button>
        </div>
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
