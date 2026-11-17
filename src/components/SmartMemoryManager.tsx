import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Lock, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getUserMemory, saveUserMemory } from "@/lib/memory.functions";
import { memoryPoints } from "@/lib/memory-rules";

export function SmartMemoryManager({ isVip, lang, onUpgrade }: { isVip: boolean; lang: "en" | "ar"; onUpgrade?: () => void }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [revision, setRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const read = useServerFn(getUserMemory);
  const save = useServerFn(saveUserMemory);

  useEffect(() => {
    if (!open || !isVip) return;
    setBusy(true); setRevision(null);
    read().then((r) => { setPoints(memoryPoints(r.memory)); setRevision(r.revision); })
      .catch(() => toast.error(ar ? "تعذر تحميل الذاكرة" : "Could not load memory"))
      .finally(() => setBusy(false));
  }, [open, isVip, read, ar]);

  const commit = async (next: string[]) => {
    if (revision === null || busy) return;
    setBusy(true);
    try {
      const r = await save({ data: { memory: next.map((p) => `- ${p}`).join("\n"), revision } });
      setPoints(memoryPoints(r.memory)); setRevision(r.revision);
    } catch { toast.error(ar ? "تعذر الحفظ، أعد فتح النافذة." : "Could not save. Reopen and try again."); }
    finally { setBusy(false); }
  };

  return <>
    <Button variant="outline" onClick={() => isVip ? setOpen(true) : onUpgrade?.()} className="h-10 w-full justify-center gap-2 text-sm">
      {isVip ? <Sparkles className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
      {ar ? "إدارة الذاكرة الذكية" : "Manage smart memory"}
    </Button>
    <Dialog open={open && isVip} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />{ar ? "الذاكرة الذكية" : "Smart memory"}</DialogTitle>
          <DialogDescription>{ar ? "ما تعلّمه BELAZO من محادثاتك" : "What BELAZO learned from your chats"}</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto">
          {points.length === 0 && <p className="py-4 text-sm text-muted-foreground">{busy ? (ar ? "جارٍ التحميل…" : "Loading…") : (ar ? "لا توجد نقاط محفوظة." : "Nothing saved yet.")}</p>}
          {points.map((p, i) => (
            <div key={i} className="mb-1 flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-card/60">
              <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="flex-1 text-sm">{p}</span>
              <button disabled={busy} aria-label={ar ? "حذف" : "Delete"} onClick={() => void commit(points.filter((_, j) => j !== i))} className="rounded p-1 opacity-60 hover:bg-destructive/20 hover:text-destructive hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy || !points.length} onClick={() => { if (window.confirm(ar ? "مسح كل الذاكرة؟" : "Clear all memory?")) void commit([]); }}>
            <Trash2 className="h-4 w-4" />{ar ? "مسح الكل" : "Clear all"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
