import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";

export function AuthPanel() {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<"g" | "a" | "guest" | null>(null);

  const oauth = async (provider: "google" | "apple") => {
    setErr(null); setLoading(provider === "google" ? "g" : "a");
    try {
      const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (r.error) { setErr(r.error.message || t.authCancelled); return; }
      if (!("redirected" in r && r.redirected)) window.location.assign("/chat");
    } catch (e) {
      setErr((e as Error).message || t.authCancelled);
    } finally { setLoading(null); }
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" size="lg" variant="secondary" disabled={loading === "g"} onClick={() => oauth("google")} className="h-14 text-base font-semibold">
          {loading === "g" ? "…" : t.signInGoogle}
        </Button>
        <Button type="button" size="lg" variant="secondary" disabled={loading === "a"} onClick={() => oauth("apple")} className="h-14 text-base font-semibold">
          {loading === "a" ? "…" : t.signInApple}
        </Button>
      </div>
      <Button type="button" size="lg" variant="outline" disabled={loading === "guest"} onClick={guest} className="h-12 w-full text-base font-semibold">
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
