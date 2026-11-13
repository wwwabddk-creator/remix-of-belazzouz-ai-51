import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AiTone } from "@/lib/freemium";

export type ThemeConfig = { colors: string[]; mode: "solid" | "gradient" };

const COLOR_MAP: Record<string, string> = {
  yellow: "#facc15", green: "#22c55e", red: "#ef4444", cyan: "#06b6d4", emerald: "#10b981",
  blue: "#3b82f6", purple: "#a855f7", pink: "#ec4899", orange: "#f97316",
  white: "#ffffff", black: "#0b0b0e",
};

export const COLOR_PRESETS = ["yellow", "green", "red", "cyan", "emerald"] as const;

const DEFAULT: ThemeConfig = { colors: ["#a855f7", "#06b6d4"], mode: "gradient" };

function applyTheme(t: ThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const main = t.colors[0] ?? DEFAULT.colors[0];
  root.style.setProperty("--primary", main);
  root.style.setProperty("--ring", main);
  root.style.setProperty("--sidebar-primary", main);
  const grad = t.colors.length > 1
    ? `linear-gradient(135deg, ${t.colors.join(", ")})`
    : `linear-gradient(135deg, ${main}, ${main})`;
  root.style.setProperty("--gradient-brand", grad);
}

export function parseColorPrompt(input: string): string[] | null {
  const text = input.toLowerCase();
  const found: string[] = [];
  const map: Record<string, string> = {
    yellow: COLOR_MAP.yellow, أصفر: COLOR_MAP.yellow, اصفر: COLOR_MAP.yellow,
    green: COLOR_MAP.green, أخضر: COLOR_MAP.green, اخضر: COLOR_MAP.green,
    red: COLOR_MAP.red, أحمر: COLOR_MAP.red, احمر: COLOR_MAP.red,
    cyan: COLOR_MAP.cyan, سماوي: COLOR_MAP.cyan,
    emerald: COLOR_MAP.emerald, زمردي: COLOR_MAP.emerald,
    blue: COLOR_MAP.blue, أزرق: COLOR_MAP.blue, ازرق: COLOR_MAP.blue,
    purple: COLOR_MAP.purple, بنفسجي: COLOR_MAP.purple,
    pink: COLOR_MAP.pink, وردي: COLOR_MAP.pink, زهري: COLOR_MAP.pink,
    orange: COLOR_MAP.orange, برتقالي: COLOR_MAP.orange,
    white: COLOR_MAP.white, أبيض: COLOR_MAP.white, ابيض: COLOR_MAP.white,
    black: COLOR_MAP.black, أسود: COLOR_MAP.black, اسود: COLOR_MAP.black,
  };
  for (const k of Object.keys(map)) {
    if (text.includes(k) && !found.includes(map[k])) found.push(map[k]);
    if (found.length >= 7) break;
  }
  return found.length ? found : null;
}

type Ctx = {
  theme: ThemeConfig; setTheme: (t: ThemeConfig) => void; reset: () => void;
  lang: "en" | "ar"; setLang: (l: "en" | "ar") => void;
  persona: string; setPersona: (p: string) => void;
  tone: AiTone; setTone: (tone: AiTone) => void;
};

const AppPrefsCtx = createContext<Ctx | null>(null);

export function AppPrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    if (typeof window === "undefined") return DEFAULT;
    try { return JSON.parse(localStorage.getItem("vib_theme") || "") || DEFAULT; } catch { return DEFAULT; }
  });
  const [lang, setLangState] = useState<"en" | "ar">(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("vib_lang") as "en" | "ar") || "en";
  });
  const [persona, setPersonaState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("vib_persona") || "";
  });
  const [tone, setToneState] = useState<AiTone>(() => {
    if (typeof window === "undefined") return "casual";
    const saved = localStorage.getItem("vib_tone");
    return saved === "formal" || saved === "concise" || saved === "detailed" ? saved : "casual";
  });

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setTheme = (t: ThemeConfig) => { setThemeState(t); try { localStorage.setItem("vib_theme", JSON.stringify(t)); } catch {} };
  const setLang = (l: "en" | "ar") => { setLangState(l); localStorage.setItem("vib_lang", l); };
  const setPersona = (p: string) => { setPersonaState(p); localStorage.setItem("vib_persona", p); };
  const setTone = (value: AiTone) => { setToneState(value); localStorage.setItem("vib_tone", value); };
  const reset = () => setTheme(DEFAULT);

  return (
    <AppPrefsCtx.Provider value={{ theme, setTheme, reset, lang, setLang, persona, setPersona, tone, setTone }}>
      {children}
    </AppPrefsCtx.Provider>
  );
}

export function useAppPrefs() {
  const v = useContext(AppPrefsCtx);
  if (!v) throw new Error("useAppPrefs must be used inside AppPrefsProvider");
  return v;
}
