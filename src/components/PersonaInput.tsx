import { useEffect, useState } from "react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { readSavedPersonas, writeSavedPersonas, type AiTone, type SavedPersona } from "@/lib/freemium";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PersonaInput({ isVip = false }: { isVip?: boolean }) {
  const { lang, persona, setPersona, tone, setTone, customTone, setCustomTone } = useAppPrefs();
  const { user } = useAuth();
  const t = T[lang];
  const ar = lang === "ar";
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPersona[]>([]);

  useEffect(() => {
    if (!user || !isVip) { setSaved([]); setActiveId(null); return; }
    setSaved(readSavedPersonas(user.id));
  }, [user?.id, isVip]);

  const save = () => {
    if (!user || !persona.trim()) return;
    const next: SavedPersona = {
      id: activeId || crypto.randomUUID(),
      name: name.trim() || (ar ? `شخصية ${saved.length + 1}` : `Persona ${saved.length + 1}`),
      content: persona.trim(),
      tone,
      customTone,
    };
    const updated = activeId ? saved.map((p) => p.id === activeId ? next : p) : [...saved, next];
    writeSavedPersonas(user.id, updated);
    setSaved(updated);
    setActiveId(next.id);
    setName(next.name);
    toast.success(ar ? "تم حفظ الشخصية." : "Persona saved.");
  };

  const choose = (id: string) => {
    const selected = saved.find((p) => p.id === id);
    if (!selected) return;
    setActiveId(id);
    setName(selected.name);
    setPersona(selected.content);
    setTone(selected.tone);
    setCustomTone(selected.customTone || "");
  };

  const remove = () => {
    if (!user || !activeId) return;
    const updated = saved.filter((p) => p.id !== activeId);
    writeSavedPersonas(user.id, updated);
    setSaved(updated);
    setActiveId(null);
    setName("");
    setPersona("");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-foreground">{t.personaTitle}</p>
        <span className="text-xs text-muted-foreground">
          {isVip ? (ar ? "VIP · شخصيات غير محدودة" : "VIP · Unlimited personas") : (ar ? "شخصية محفوظة واحدة" : "1 saved persona")}
        </span>
      </div>
      {isVip && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={ar ? "اسم الشخصية" : "Persona name"} className="h-11" />
          <Select value={tone} onValueChange={(value) => setTone(value as AiTone)}>
            <SelectTrigger className="h-11" aria-label={ar ? "نغمة رد الذكاء الاصطناعي" : "AI response tone"}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">{ar ? "رسمية" : "Formal"}</SelectItem>
              <SelectItem value="casual">{ar ? "ودّية" : "Casual"}</SelectItem>
              <SelectItem value="concise">{ar ? "مختصرة" : "Concise"}</SelectItem>
              <SelectItem value="detailed">{ar ? "مفصّلة" : "Detailed"}</SelectItem>
              <SelectItem value="custom">{ar ? "مخصّصة" : "Custom"}</SelectItem>
            </SelectContent>
          </Select>
          {tone === "custom" && (
            <Textarea
              value={customTone}
              onChange={(e) => setCustomTone(e.target.value)}
              aria-label={ar ? "أسلوب الرد المخصّص" : "Custom response style"}
              placeholder={ar ? "اكتب أسلوب الرد الذي تريده…" : "Write your preferred response style…"}
              maxLength={200}
              rows={2}
              className="text-base sm:col-span-2"
            />
          )}
        </div>
      )}
      <Textarea
        value={persona}
        onChange={(e) => setPersona(e.target.value)}
        placeholder={t.personaPh}
        maxLength={500}
        rows={3}
        className="text-base"
      />
      {isVip && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!persona.trim()} className="h-10 gap-2"><Save />{ar ? "حفظ الشخصية" : "Save persona"}</Button>
            <Button variant="outline" onClick={() => { setActiveId(null); setName(""); setPersona(""); }} className="h-10 gap-2"><Plus />{ar ? "جديدة" : "New"}</Button>
            {activeId && <Button variant="ghost" onClick={remove} className="h-10 gap-2 text-destructive"><Trash2 />{ar ? "حذف" : "Delete"}</Button>}
          </div>
          {saved.length > 0 && (
            <Select value={activeId || undefined} onValueChange={choose}>
              <SelectTrigger className="h-11"><SelectValue placeholder={ar ? "التبديل بين الشخصيات المحفوظة" : "Switch between saved personas"} /></SelectTrigger>
              <SelectContent>{saved.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </>
      )}
    </div>
  );
}
