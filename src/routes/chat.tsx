import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppPrefsProvider, useAppPrefs } from "@/lib/app-prefs";
import { useAuth } from "@/hooks/use-auth";
import { T } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { isUnsafePrompt, safetyRefusal } from "@/lib/client-limits";
import { addLibraryItem, saveGeneratedContent } from "@/lib/library";
import { consumeUserMessage, quotaMessage, readVipStatus, toneInstruction } from "@/lib/freemium";

import { supabase } from "@/integrations/supabase/client";
import { chatStream } from "@/lib/chat.functions";
import { webSearch, type WebSearchResult } from "@/lib/search.functions";
import { aiImageGenerate } from "@/lib/imagegen.functions";
import { aiImageEdit } from "@/lib/image.functions";
import { Crown, Languages, LogOut, Send, Square, Menu } from "lucide-react";
import { UserAvatar, AvatarSettings } from "@/components/UserAvatar";
import { ColorCustomizer } from "@/components/ColorCustomizer";
import { PersonaInput } from "@/components/PersonaInput";
import { GroupChat } from "@/components/GroupChat";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { VipModal } from "@/components/VipModal";
import { extractUserMemory } from "@/lib/memory.functions";
import { AttachmentButton, type Attachment } from "@/components/AttachmentButton";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { MessageContent } from "@/components/MessageContent";
import { VoiceCallModal } from "@/components/VoiceCallModal";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [
    { title: "BELAZO AI — Chat & Library" },
    { name: "description", content: "Create images, code and text with BELAZO AI and revisit them in your library." },
    { property: "og:title", content: "BELAZO AI — Chat & Library" },
    { property: "og:description", content: "Your BELAZO AI conversations and generated content library." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AppPrefsProvider><ChatPage /></AppPrefsProvider>,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: WebSearchResult[]; attachments?: Attachment[]; image?: string };

function ChatPage() {
  const { user, loading, isSuperAdmin } = useAuth();
  const nav = useNavigate();
  const { lang, setLang, reset, persona, tone, customTone } = useAppPrefs();
  const t = T[lang];
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showVip, setShowVip] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const streamFn = useServerFn(chatStream);
  const searchFn = useServerFn(webSearch);
  const genFn = useServerFn(aiImageGenerate);
  const editFn = useServerFn(aiImageEdit);
  const extractMemory = useServerFn(extractUserMemory);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [mode, setMode] = useState<"fast" | "deep" | "hybrid">("hybrid");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSubscriber = isSuperAdmin || isVip;
  const libraryError = () => toast.error(lang === "ar" ? "تعذر حفظ المحتوى في المكتبة." : "Could not save content to the library.");


  useEffect(() => { if (!loading && !user) nav({ to: "/" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) { setIsVip(false); return; }
    readVipStatus(user).then(setIsVip).catch(() => setIsVip(false));
  }, [user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const newChat = () => { setConvId(null); setMessages([]); setSidebarOpen(false); };

  const loadConversation = async (id: string) => {
    setConvId(id);
    setSidebarOpen(false);
    const { data } = await supabase
      .from("messages").select("role,content")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (data) setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
  };

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setBusy(false); };

  const send = async () => {
    if ((!input.trim() && pending.length === 0) || busy) return;
    const q = input.trim();
    const atts = pending;
    if (!user) return;
    try {
      const quota = await consumeUserMessage(user);
      if (!quota.allowed) {
        toast.warning(quotaMessage(lang, user.is_anonymous === true));
        return;
      }
      if (quota.is_vip) setIsVip(true);
    } catch {
      toast.error(lang === "ar" ? "تعذر التحقق من رصيد الرسائل." : "Could not verify your message allowance.");
      return;
    }

    // A separate authenticated request saves durable facts without delaying the reply.
    if (q) void extractMemory({ data: { message: q } }).catch(() => {});

    // Omni-intent routing
    const attachedImage = pending.find((p) => p.type?.startsWith("image/"));
    const editIntent = q && /(عدّ?ل|عدل\s*الصور[ةه]|غيّ?ر|أزل|ازل|اضف|أضف|حسّ?ن|كبّ?ر|لوّ?ن|اقطع|edit|modify|change|remove|add|enhance|upscale|recolor|retouch|fix\s+(?:the\s+)?image)/i.test(q);
    if (q) {
      // Voice call intent
      if (/(تحدث\s*معي\s*صوتي|اتصل\s*بي|محادثة\s*وجه|شغل\s*الصوت|voice\s*call|call\s*me|face\s*to\s*face)/i.test(q)) {
        setInput(""); setShowCall(true); return;
      }
      // Edit-image intent — uses uploaded image OR the last generated/edited image
      if (editIntent && (attachedImage || lastImage)) {
        const src = attachedImage?.url || lastImage!;
        setMessages((m) => [...m, { role: "user", content: q, attachments: attachedImage ? [attachedImage] : undefined }, { role: "assistant", content: "" }]);
        setInput(""); setPending([]); setBusy(true);
        try {
          // Convert URL to base64 dataUrl (gateway needs full dataUrl)
          let dataUrl = src;
          if (!src.startsWith("data:")) {
            try {
              const b = await fetch(src).then((r) => r.blob());
              dataUrl = await new Promise<string>((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result as string);
                fr.onerror = rej;
                fr.readAsDataURL(b);
              });
            } catch { /* keep original */ }
          }
          const r = await editFn({ data: { imageBase64: dataUrl, mimeType: "image/png", prompt: q, mode: /(كبّ?ر|حسّ?ن|upscale|enhance)/i.test(q) ? "upscale" : "edit" } });
          setLastImage(r.dataUrl);
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: lang === "ar" ? "تم التعديل:" : "Edited:", image: r.dataUrl };
            return copy;
          });
          if (user) await addLibraryItem({ kind: "image", title: q.slice(0, 60), url: r.dataUrl }, user.id).catch(libraryError);
        } finally { setBusy(false); }
        return;
      }
      // Image-gen intent → rewrite to /image (broadened verbs incl. picture/photo/illustration)
      const imgIntent = q.match(/^(?:ارسم(?:\s*لي)?|صمم(?:\s*لي)?|اصنع(?:\s*لي)?\s*(?:صور[ةه]|رسم[ةه])|صور[ةه]\s*ل?ـ?|draw|paint|sketch|design\s+(?:an?\s+)?image|generate\s+(?:an?\s+)?(?:image|picture|photo|illustration)|create\s+(?:an?\s+)?(?:image|picture|photo|illustration)|make\s+(?:an?\s+)?(?:image|picture|photo|illustration)\s+of|picture\s+of|photo\s+of)\s+(.+)/i);
      if (imgIntent) {
        const prompt = imgIntent[1];
        setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
        setInput(""); setPending([]); setBusy(true);
        try {
          const r = await genFn({ data: { prompt } });
          setLastImage(r.dataUrl);
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: lang === "ar" ? "تم توليد الصورة:" : "Generated image:", image: r.dataUrl };
            return copy;
          });
          if (user) await addLibraryItem({ kind: "image", title: prompt.slice(0, 60), url: r.dataUrl }, user.id).catch(libraryError);
        } finally { setBusy(false); }
        return;
      }
      // Video intent — graceful note
      if (/(^|\s)(فيديو\s*ل|صانع\s*الفيديو|اصنع\s*كليب|make\s+(?:a\s+)?video|video\s+of)/i.test(q)) {
        setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: lang === "ar" ? "🎬 توليد الفيديو قادم قريباً. حالياً يمكنني توليد الصور والكود والنصوص." : "🎬 Video generation is coming soon. For now I can produce images, code and text." }]);
        setInput(""); return;
      }
    }

    // Safety filter
    if (q && isUnsafePrompt(q)) {
      setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: safetyRefusal(lang) }]);
      setInput("");
      return;
    }

    // Explicit /image trigger (kept for power users)
    const genMatch = q.match(/^\/(image|img|صورة)\s+([\s\S]+)/i);

    const userMsg: Msg = { role: "user", content: q || (atts.length ? `📎 ${atts.length} file(s)` : ""), attachments: atts.length ? atts : undefined };
    const next = [...messages, userMsg];

    if (genMatch) {
      setMessages([...next, { role: "assistant", content: "" }]);
      setInput(""); setPending([]); setBusy(true);
      try {
        const r = await genFn({ data: { prompt: genMatch[2] } });
        setLastImage(r.dataUrl);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: lang === "ar" ? "تم توليد الصورة:" : "Generated image:", image: r.dataUrl };
          return copy;
        });
        if (user) await addLibraryItem({ kind: "image", title: genMatch[2].slice(0, 60), url: r.dataUrl }, user.id).catch(libraryError);
      } finally { setBusy(false); }
      return;
    }

    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setPending([]);
    setBusy(true);
    abortRef.current = new AbortController();

    let activeId = convId;
    if (user) {
      try {
        if (!activeId) {
          const title = q.length > 60 ? q.slice(0, 60) + "…" : q;
          const ins = await supabase.from("conversations").insert({ user_id: user.id, title }).select("id").single();
          if (ins.data) { activeId = ins.data.id; setConvId(activeId); }
        }
        if (activeId) {
          await supabase.from("messages").insert({ conversation_id: activeId, user_id: user.id, role: "user", content: q });
        }
      } catch { /* best-effort */ }
    }

    try {
      // Live online verification — runs in parallel with stream prep
      const searchPromise = searchFn({ data: { q } }).catch(() => ({ results: [] as WebSearchResult[], summary: "" }));
      const search = await searchPromise;
      const personaWithMem = [
        isVip ? toneInstruction(tone, customTone) : "",
        persona ? `\n\n${persona}` : "",
      ].join("").trim();
      const iter = (await streamFn({ data: { messages: next, lang, mode, persona: personaWithMem ? personaWithMem.slice(0, 500) : undefined, webContext: search.summary || undefined, webConfidence: (search as { confidence?: number }).confidence, webProviders: (search as { providersUsed?: string[] }).providersUsed } })) as AsyncIterable<{ delta?: string }>;
      let acc = "";
      for await (const chunk of iter) {
        if (abortRef.current?.signal.aborted) break;
        const delta = chunk?.delta;
        if (!delta) continue;
        acc += delta;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc, sources: search.results };
          return copy;
        });
      }

      if (user && acc.trim() && !abortRef.current?.signal.aborted) {
        await saveGeneratedContent(acc, q || acc, user.id).catch(libraryError);
      }
      if (user && activeId && acc) {
        try {
          await supabase.from("messages").insert({ conversation_id: activeId, user_id: user.id, role: "assistant", content: acc });
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeId);
          setHistoryKey((k) => k + 1);
        } catch { /* ignore */ }
      }
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Error: " + (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const followUp = (instruction: string) => {
    setInput(instruction);
    setTimeout(() => send(), 0);
  };

  // Tiny dynamic suggestion bar based on the current draft.
  const suggestions = (() => {
    const v = input.trim().toLowerCase();
    if (!v) {
      return lang === "ar"
        ? ["لخّص آخر الأخبار", "اكتب لي بريد رسمي", "/image قطة بأسلوب فان كوخ"]
        : ["Summarize the latest news", "Draft a formal email", "/image a cat in Van Gogh style"];
    }
    if (v.startsWith("/image") || v.includes("صورة")) {
      return lang === "ar" ? ["بأسلوب سينمائي 4K", "ألوان دافئة", "إضاءة درامية"] : ["cinematic 4K", "warm palette", "dramatic lighting"];
    }
    if (/code|كود|function|دالة/.test(v)) {
      return lang === "ar" ? ["اكتب الكود بـ TypeScript", "أضف اختبارات", "اشرح السطر بالسطر"] : ["use TypeScript", "add tests", "explain line by line"];
    }
    if (/translate|ترجم/.test(v)) {
      return lang === "ar" ? ["إلى الإنجليزية", "إلى الفرنسية", "احتفظ بالنبرة"] : ["to English", "to French", "keep the tone"];
    }
    return lang === "ar" ? ["اشرح ببساطة", "أعطني خطوات", "أضف مثالاً"] : ["explain simply", "give me steps", "add an example"];
  })();

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;


  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" title={t.history}><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side={lang === "ar" ? "right" : "left"} className="w-80 p-0">
              <div className="h-full pt-10">
                <ChatHistorySidebar
                  activeId={convId}
                  refreshKey={historyKey}
                  onSelect={loadConversation}
                  onNew={newChat}
                  isVip={isVip}
                />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-bold brand-text">{t.brand}</h1>
        </div>
        <div className="flex items-center gap-1">
          {isSuperAdmin && <span className="me-2 rounded-full bg-[color:var(--vip)]/20 px-2 py-0.5 text-xs font-medium text-[color:var(--vip)]">{t.superAdmin}</span>}
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShowCustom((s) => !s)} title={lang === "ar" ? "إعدادات الملف الشخصي" : "Profile settings"} aria-label={lang === "ar" ? "إعدادات الملف الشخصي" : "Profile settings"} aria-expanded={showCustom}><UserAvatar user={user} /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={reset} title={t.reset}>↺</Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setLang(lang === "en" ? "ar" : "en")}><Languages className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="vip-header-badge h-11 w-11" onClick={() => setShowVip(true)} title={t.vip} aria-label={t.vip}><Crown className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      {showCustom && (
        <div className="border-b border-border bg-card/30 p-4 space-y-4">
          <AvatarSettings user={user} lang={lang} />
          <ColorCustomizer />
          <PersonaInput isVip={isVip} />
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        <Tabs defaultValue="chat" className="flex flex-1 flex-col">
          <TabsList className="mb-4 h-12 w-full">
            <TabsTrigger value="chat" className="flex-1 h-10 text-base">{t.chat}</TabsTrigger>
            <TabsTrigger value="group" className="flex-1 h-10 text-base">{t.group}</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-muted-foreground">
                  <p className="brand-text text-3xl font-bold">{t.brand}</p>
                  <p className="mt-2 text-sm">{t.tagline}</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-base ${m.role === "user" ? "brand-gradient text-primary-foreground" : "bg-card text-card-foreground"}`}>
                    {m.content?.startsWith("__audio__:")
                      ? <audio src={m.content.slice(10)} controls className="h-10" />
                      : (m.content
                          ? <MessageContent content={m.content} role={m.role} lang={lang} onFollowUp={followUp} />
                          : <span className="type-cursor inline-block min-h-[1em] min-w-[1ch]" />)}

                    {m.attachments?.map((a, k) => <AttachmentPreview key={k} att={a} />)}
                    {m.image && <img src={m.image} alt="generated" className="mt-2 max-h-80 w-auto rounded-lg" />}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-border/40 pt-2">
                        <p className="mb-1 text-xs font-semibold opacity-80">{t.sources}</p>
                        <ul className="space-y-1">
                          {m.sources.slice(0, 4).map((s, j) => (
                            <li key={j} className="text-xs">
                              <a href={s.url} target="_blank" rel="noreferrer" className="underline opacity-80 hover:opacity-100">[{j + 1}] {s.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && <UserAvatar user={user} />}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {pending.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs">
                {pending.map((p, i) => (
                  <span key={i} className="flex items-center gap-1 rounded bg-background/50 px-2 py-0.5">
                    📎 <span className="max-w-[10rem] truncate">{p.name}</span>
                    <button onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))} className="text-destructive hover:underline">×</button>
                  </span>
                ))}
                <button onClick={() => setPending([])} className="ms-auto text-destructive hover:underline">
                  {lang === "ar" ? "إزالة الكل" : "remove all"}
                </button>
              </div>
            )}

            {/* Dynamic suggestion bar */}
            <div className="mt-3 flex flex-wrap items-center gap-2">

              <div className="flex flex-1 flex-wrap gap-1 overflow-x-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput((cur) => (cur ? cur + " " : "") + s)}
                    className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-end gap-2 rounded-2xl border border-border bg-card/60 p-2 backdrop-blur">
              <AttachmentButton onUploaded={(atts) => setPending((cur) => [...cur, ...atts])} disabled={busy} isSubscriber={isSubscriber} />
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`${t.typeMessage}  ·  /image …`}
                disabled={busy}
                rows={1}
                className="min-h-[3.5rem] max-h-48 resize-none border-0 bg-transparent text-base focus-visible:ring-0"
              />
              {busy ? (
                <Button onClick={stop} className="h-14 w-14 bg-destructive text-destructive-foreground hover:bg-destructive/90" title={lang === "ar" ? "إيقاف" : "Stop"}>
                  <Square className="h-5 w-5" />
                </Button>
              ) : (
                <Button onClick={send} disabled={!input.trim() && pending.length === 0} className="h-14 w-14 brand-gradient text-primary-foreground" title={lang === "ar" ? "إرسال" : "Send"}>
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>

          </TabsContent>

          <TabsContent value="group">
            <GroupChat />
          </TabsContent>
        </Tabs>
      </main>
      
      <VipModal open={showVip} onOpenChange={setShowVip} isVip={isVip} />
      <VoiceCallModal
        open={showCall}
        onOpenChange={setShowCall}
        lang={lang}
        onAsk={async (text) => {
          try {
            const quota = await consumeUserMessage(user);
            if (!quota.allowed) return quotaMessage(lang, user.is_anonymous === true);
            if (text.trim()) void extractMemory({ data: { message: text } }).catch(() => {});
            const iter = (await streamFn({ data: { messages: [{ role: "user", content: text }], lang, mode: "fast", persona: isVip ? toneInstruction(tone, customTone) : undefined } })) as AsyncIterable<{ delta?: string }>;
            let acc = "";
            for await (const c of iter) acc += c?.delta || "";
            return acc || (lang === "ar" ? "نعم؟" : "Yes?");
          } catch { return lang === "ar" ? "حدث خطأ، حاول مجدداً." : "Something went wrong, try again."; }
        }}
      />
    </div>
  );
}
