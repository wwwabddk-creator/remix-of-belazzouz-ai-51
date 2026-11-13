import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, MessageSquare, MoreVertical, Pencil, BookMarked, Brain, Image as ImageIcon, Code, FileText, Download } from "lucide-react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  readMemory, forgetFact, rememberFact,
} from "@/lib/client-limits";
import { readLibrary, removeLibraryItem, LIBRARY_CHANGED, type LibItem, type LibKind } from "@/lib/library";
import { filterLibrary } from "@/lib/library-content";
import { toast } from "sonner";

export type Conv = { id: string; title: string; updated_at: string };

// Re-export for legacy callers.
export { addLibraryItem } from "@/lib/client-limits";

export function ChatHistorySidebar({
  activeId, onSelect, onNew, refreshKey, isVip = false,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
  isVip?: boolean;
}) {
  const { user } = useAuth();
  const { lang } = useAppPrefs();
  const t = T[lang];
  const [items, setItems] = useState<Conv[]>([]);
  const [tab, setTab] = useState<"chats" | "library" | "memory">("chats");
  const [lib, setLib] = useState<LibItem[]>([]);
  const [libFilter, setLibFilter] = useState<"all" | LibKind>("all");
  const [mem, setMem] = useState<string[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations").select("id,title,updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false });
    setItems((data as Conv[]) || []);
  };
  useEffect(() => {
    load();
    setMem(readMemory());
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user, refreshKey]);

  useEffect(() => {
    let active = true;
    setLib([]);
    if (!user) return;
    const reload = () => {
      readLibrary(user.id).then((items) => { if (active) setLib(items); })
        .catch(() => { if (active) toast.error(lang === "ar" ? "تعذر تحميل المكتبة." : "Could not load library."); });
    };
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === user.id) reload();
    };
    reload();
    window.addEventListener(LIBRARY_CHANGED, onChange);
    return () => { active = false; window.removeEventListener(LIBRARY_CHANGED, onChange); };
  }, [user?.id, lang]);

  const delOne = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from("messages").delete().eq("conversation_id", id);
    await supabase.from("conversations").delete().eq("id", id);
    if (activeId === id) onNew();
    load();
  };
  const renameOne = async (c: Conv) => {
    const next = window.prompt(lang === "ar" ? "اسم جديد:" : "New name:", c.title || "");
    if (!next || next.trim() === c.title) return;
    await supabase.from("conversations").update({ title: next.trim().slice(0, 120) }).eq("id", c.id);
    load();
  };
  const delAll = async () => {
    if (!user) return;
    if (!confirm(t.confirmDeleteAll)) return;
    await supabase.from("messages").delete().eq("user_id", user.id);
    await supabase.from("conversations").delete().eq("user_id", user.id);
    onNew(); load();
  };
  const exportHistory = async () => {
    if (!user || !isVip) return;
    const [{ data: conversations }, { data: messages }] = await Promise.all([
      supabase.from("conversations").select("id,title,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("messages").select("conversation_id,role,content,created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      conversations: (conversations || []).map((conversation) => ({
        ...conversation,
        messages: (messages || []).filter((message) => message.conversation_id === conversation.id),
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `belazo-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const removeLib = async (id: string) => {
    if (!user) return;
    try { await removeLibraryItem(id, user.id); }
    catch { toast.error(lang === "ar" ? "تعذر حذف العنصر." : "Could not delete item."); }
  };
  const addMem = () => {
    const v = window.prompt(lang === "ar" ? "ماذا تريد أن أتذكر؟" : "What should I remember?");
    if (v) { rememberFact(v); setMem(readMemory()); }
  };
  const dropMem = (fact: string) => {
    forgetFact(fact); setMem(readMemory());
  };

  const filteredLib = filterLibrary(lib, libFilter);
  const kindIcon = (k: LibKind) =>
    k === "image" ? <ImageIcon className="h-4 w-4 opacity-60" /> :
    k === "code" ? <Code className="h-4 w-4 opacity-60" /> :
    <FileText className="h-4 w-4 opacity-60" />;

  return (
    <aside className="flex h-full w-72 flex-col gap-2 border-e border-border bg-card/30 p-3">
      <div className="flex gap-1 rounded-lg bg-background/40 p-1">
        {([
          { id: "chats", label: lang === "ar" ? "المحادثات" : "Chats", Icon: MessageSquare },
          { id: "library", label: lang === "ar" ? "المكتبة" : "Library", Icon: BookMarked },
          { id: "memory", label: lang === "ar" ? "الذاكرة" : "Memory", Icon: Brain },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium ${tab === id ? "bg-card text-foreground" : "text-muted-foreground"}`}
          >
            <Icon className="me-1 inline h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "chats" && (
        <>
          <Button onClick={delAll} variant="destructive" className="h-11 w-full justify-center gap-2 text-sm font-bold">
            <Trash2 className="h-4 w-4" /> {t.deleteAllChats}
          </Button>
          <Button onClick={onNew} variant="outline" className="h-11 w-full justify-center gap-2">
            <Plus className="h-4 w-4" /> {t.newChat}
          </Button>
          {isVip && (
            <Button onClick={exportHistory} variant="outline" className="h-11 w-full justify-center gap-2">
              <Download className="h-4 w-4" /> {lang === "ar" ? "تصدير السجل الكامل" : "Export full history"}
            </Button>
          )}
          <div className="-mx-1 mt-1 flex-1 overflow-y-auto px-1">
            {items.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground">—</p>}
            {items.map((c) => (
              <div key={c.id} className={`group mb-1 flex items-center gap-1 rounded-lg px-2 py-2 ${activeId === c.id ? "bg-card" : "hover:bg-card/60"}`}>
                <button onClick={() => onSelect(c.id)} className="flex flex-1 items-center gap-2 truncate text-start text-sm">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">{c.title || t.newChat}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-1 opacity-60 hover:bg-background/40 hover:opacity-100" aria-label="More">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => renameOne(c)}>
                      <Pencil className="me-2 h-4 w-4" /> {lang === "ar" ? "إعادة تسمية" : "Rename"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => delOne(c.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="me-2 h-4 w-4" /> {lang === "ar" ? "حذف" : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "library" && (
        <>
          <div className="flex gap-1 rounded-md bg-background/40 p-1 text-xs">
            {(["all", "image", "code", "text"] as const).map((k) => (
              <Button variant="ghost"
                key={k}
                onClick={() => setLibFilter(k)}
                className={`h-auto flex-1 rounded px-2 py-1 text-xs ${libFilter === k ? "bg-card" : "text-muted-foreground"}`}
              >
                {k === "all" ? (lang === "ar" ? "الكل" : "All")
                  : k === "image" ? (lang === "ar" ? "صور" : "Images")
                  : k === "code" ? (lang === "ar" ? "كود" : "Code")
                  : (lang === "ar" ? "نص" : "Text")}
              </Button>
            ))}
          </div>
          <div className="-mx-1 mt-1 flex-1 overflow-y-auto px-1">
            {filteredLib.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {lang === "ar" ? "لا توجد عناصر." : "No items."}
              </p>
            )}
            {filteredLib.map((item) => (
              <div key={item.id} className="group mb-1 rounded-lg px-2 py-2 hover:bg-card/60">
                <div className="flex items-center gap-1">
                  {kindIcon(item.kind)}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-start text-sm underline">{item.title}</a>
                  ) : (
                    <span className="flex-1 truncate text-sm">{item.title}</span>
                  )}
                  <Button variant="ghost" size="icon" aria-label={lang === "ar" ? "حذف العنصر" : "Delete item"} onClick={() => removeLib(item.id)} className="h-6 w-6 rounded p-1 opacity-60 hover:bg-destructive/20 hover:text-destructive hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {item.kind === "image" && item.url && (
                  <img src={item.url} alt={item.title} className="mt-1 max-h-28 w-auto rounded" />
                )}
                {item.body && item.kind !== "image" && (
                  <pre className="mt-1 max-h-24 overflow-auto rounded bg-background/40 p-1 text-[10px]">{item.body}</pre>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "memory" && (
        <>
          <Button onClick={addMem} variant="outline" className="h-10 w-full justify-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> {lang === "ar" ? "أضف ذكرى" : "Add memory"}
          </Button>
          <p className="px-1 text-[10px] text-muted-foreground">
            {lang === "ar" ? "اكتب في الدردشة: /remember … أو /forget …" : "In chat type: /remember … or /forget …"}
          </p>
          <div className="-mx-1 mt-1 flex-1 overflow-y-auto px-1">
            {mem.length === 0 && (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {lang === "ar" ? "لا توجد ذكريات." : "No memories yet."}
              </p>
            )}
            {mem.map((fact, i) => (
              <div key={i} className="group mb-1 flex items-start gap-1 rounded-lg px-2 py-2 hover:bg-card/60">
                <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="flex-1 text-xs">{fact}</span>
                <button onClick={() => dropMem(fact)} className="rounded p-1 opacity-60 hover:bg-destructive/20 hover:text-destructive hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
