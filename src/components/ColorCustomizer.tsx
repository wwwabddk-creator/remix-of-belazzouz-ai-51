import { useState } from "react";
import { useAppPrefs, COLOR_PRESETS, parseColorPrompt } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SWATCH: Record<string, string> = {
  yellow: "#facc15", green: "#22c55e", red: "#ef4444", cyan: "#06b6d4", emerald: "#10b981",
};

export function ColorCustomizer() {
  const { theme, setTheme, lang } = useAppPrefs();
  const t = T[lang];
  const [picked, setPicked] = useState<string[]>(theme.colors);
  const [prompt, setPrompt] = useState("");

  const toggle = (hex: string) => {
    setPicked((p) => {
      const next = p.includes(hex) ? p.filter((x) => x !== hex) : [...p, hex].slice(0, 7);
      const tc = { colors: next.length ? next : ["#a855f7"], mode: (next.length > 1 ? "gradient" : "solid") as "solid" | "gradient" };
      setTheme(tc);
      return next;
    });
  };

  const applyPrompt = () => {
    const colors = parseColorPrompt(prompt);
    if (colors) {
      setPicked(colors);
      setTheme({ colors, mode: colors.length > 1 ? "gradient" : "solid" });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <p className="text-base font-semibold text-foreground">{t.customizeAppearance}</p>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">{t.pickColors}</p>
        <div className="flex flex-wrap gap-3">
          {COLOR_PRESETS.map((name) => {
            const hex = SWATCH[name];
            const active = picked.includes(hex);
            return (
              <button
                key={name}
                onClick={() => toggle(hex)}
                aria-pressed={active}
                className={`h-12 w-12 rounded-full border-2 transition ${active ? "border-foreground scale-110" : "border-border"}`}
                style={{ background: hex }}
                title={name}
              />
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder={t.colorPromptPh}
          className="h-12 text-base"
          onKeyDown={(e) => { if (e.key === "Enter") applyPrompt(); }}
        />
        <Button type="button" size="lg" onClick={applyPrompt} className="h-12">{t.apply}</Button>
      </div>
      {picked.length > 0 && (
        <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${picked.join(", ")})` }} />
      )}
    </div>
  );
}
