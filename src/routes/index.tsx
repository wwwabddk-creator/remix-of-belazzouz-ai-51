import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useState } from "react";
import { AppPrefsProvider, useAppPrefs } from "@/lib/app-prefs";
import { AuthPanel } from "@/components/AuthPanel";
import { ColorCustomizer } from "@/components/ColorCustomizer";
import { PersonaInput } from "@/components/PersonaInput";
import { T } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Crown, Languages, Paintbrush } from "lucide-react";
import { VipModal } from "@/components/VipModal";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "BELAZO AI — Sign In" },
    { name: "description", content: "Sign in to BELAZO AI to create and chat." },
    { property: "og:title", content: "BELAZO AI — Sign In" },
    { property: "og:description", content: "Access your BELAZO AI account and conversations." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AppPrefsProvider><Landing /></AppPrefsProvider>,
});

function Landing() {
  const { lang, setLang, reset } = useAppPrefs();
  const t = T[lang];
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [showVip, setShowVip] = useState(false);
  useEffect(() => { if (!loading && user) nav({ to: "/chat" }); }, [loading, user, nav]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-bold brand-text">{t.brand}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="lg" onClick={reset} title={t.reset} className="h-12 w-12 p-0">
            <Paintbrush className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="h-12">
            <Languages className="me-2 h-5 w-5" />{lang === "en" ? "AR" : "EN"}
          </Button>
          <Button variant="ghost" size="lg" className="vip-header-badge h-12 px-4" onClick={() => setShowVip(true)}>
            <Crown className="me-2 h-5 w-5" />{t.vip}
          </Button>
        </div>
      </header>

      <div className="grid flex-1 items-start gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-5xl font-bold leading-tight">
            <span className="brand-text">{t.brand}</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">{t.tagline}</p>
        </div>
        <div className="space-y-5">
          <AuthPanel />
          <ColorCustomizer />
          <PersonaInput />
        </div>
      </div>
      <VipModal open={showVip} onOpenChange={setShowVip} isVip={false} />
    </main>
  );
}
