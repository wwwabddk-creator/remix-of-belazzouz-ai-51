import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Lock, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getUserMemory, saveUserMemory } from "@/lib/memory.functions";

export function MemorySettings({ isVip, lang, onUpgrade }: {
  isVip: boolean; lang: "en" | "ar"; onUpgrade: () => void;
}) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const read = useServerFn(getUserMemory);
  const save = useServerFn(saveUserMemory);

  useEffect(() => {
    if (!open || !isVip) return;
    let active = true;
    setLoading(true); setError(false); setRevision(null); setMemory("");
    read().then((result) => {
      if (active) { setMemory(result.memory); setRevision(result.revision); }
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, isVip, read]);

  const commit = async (value: string) => {
    if (revision === null || saving) return;
    setSaving(true);
    try {
      const result = await save({ data: { memory: value, revision } });
      setMemory(result.memory); setRevision(result.revision);
      toast.success(ar ? "تم حفظ الذاكرة" : "Memory saved");
    } catch { toast.error(ar ? "تعذر الحفظ. أعد فتح الذاكرة وحاول مجدداً." : "Could not save. Reopen memory and try again."); }
    finally { setSaving(false); }
  };

  return <>
    <Button variant="outline" size="sm" onClick={() => isVip ? setOpen(true) : onUpgrade()}>
      {isVip ? <Brain className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {ar ? "الذاكرة" : "Memory"}
    </Button>
    <Dialog open={open && isVip} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{ar ? "الذاكرة" : "Memory"}</DialogTitle>
          <DialogDescription>{ar ? "ما يتذكره BELAZO عنك" : "What BELAZO remembers about you"}</DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-muted-foreground">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
          : error ? <p role="alert" className="text-sm text-destructive">{ar ? "تعذر تحميل الذاكرة" : "Could not load memory"}</p>
          : <Textarea aria-label={ar ? "المعلومات المحفوظة" : "Saved memories"} value={memory} onChange={(e) => setMemory(e.target.value)} rows={9} className="max-h-80 resize-y" disabled={saving} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={loading || saving || revision === null || !memory} onClick={() => {
            if (window.confirm(ar ? "مسح كل الذاكرة؟" : "Clear all memory?")) void commit("");
          }}><Trash2 className="h-4 w-4" />{ar ? "مسح الذاكرة" : "Clear memory"}</Button>
          <Button disabled={loading || saving || revision === null} onClick={() => void commit(memory)}><Save className="h-4 w-4" />{ar ? "حفظ" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}