import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";

export function PersonaInput() {
  const { lang, persona, setPersona } = useAppPrefs();
  const t = T[lang];
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <p className="text-base font-semibold text-foreground">{t.personaTitle}</p>
      <Textarea
        value={persona}
        onChange={(e) => setPersona(e.target.value)}
        placeholder={t.personaPh}
        rows={3}
        className="text-base"
      />
    </div>
  );
}
