import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppPrefsProvider, useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Copy, Sparkles } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AttachmentButton, type Attachment } from "@/components/AttachmentButton";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { roomAiReply } from "@/lib/room.functions";

export const Route = createFileRoute("/room/$roomId")({
  component: () => (
    <AppPrefsProvider>
      <RoomPage />
    </AppPrefsProvider>
  ),
});

type RMsg = {
  id: string;
  room_id: string;
  user_id: string | null;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  content: string;
  attachments: Attachment[] | null;
  audio_url: string | null;
  created_at: string;
};

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, loading } = useAuth();
  const { lang, persona } = useAppPrefs();
  const t = T[lang];
  const nav = useNavigate();
  const [roomName, setRoomName] = useState<string>("Group room");
  const [msgs, setMsgs] = useState<RMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const aiReplyFn = useServerFn(roomAiReply);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const room = await supabase.from("chat_rooms").select("name").eq("id", roomId).maybeSingle();
      if (active && room.data) setRoomName(room.data.name);
      const { data } = await supabase
        .from("chat_room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (active && data) setMsgs(data as unknown as RMsg[]);
    })();
    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_room_messages", filter: `room_id=eq.${roomId}` },
        (p) => setMsgs((m) => [...m, p.new as unknown as RMsg]),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [roomId, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const insertMsg = async (content: string, extras: Partial<RMsg> = {}) => {
    if (!user) return;
    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split("@")[0] ||
      "User";
    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;
    await supabase.from("chat_room_messages").insert({
      room_id: roomId,
      user_id: user.id,
      role: "user",
      display_name: displayName,
      avatar_url: avatar,
      content,
      attachments: extras.attachments ?? null,
      audio_url: extras.audio_url ?? null,
    });
  };

  const askAi = async (recent: RMsg[]) => {
    const history = recent
      .filter((m) => m.content.trim())
      .slice(-12)
      .map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        name: m.display_name || undefined,
        content: m.content,
      }));
    try {
      await aiReplyFn({ data: { roomId, lang, persona: persona || undefined, history } });
    } catch (e) {
      console.error("ai reply failed", e);
    }
  };

  const send = async () => {
    if (sending) return;
    const content = input.trim();
    if (!content && !pending) return;
    setSending(true);
    try {
      const payload: Partial<RMsg> = {};
      if (pending) payload.attachments = [pending];
      await insertMsg(content || (pending ? `📎 ${pending.name}` : ""), payload);
      setInput("");
      setPending(null);
      const mentionsAi = /(belazo|بيلازو|بلازو|bellazo|@ai|@الذكاء)/i.test(content);
      if (mentionsAi) {
        const recent = [
          ...msgs,
          {
            id: "tmp",
            room_id: roomId,
            user_id: user?.id ?? null,
            role: "user",
            display_name: user?.user_metadata?.full_name ?? user?.email ?? "User",
            avatar_url: null,
            content,
            attachments: null,
            audio_url: null,
            created_at: new Date().toISOString(),
          } as RMsg,
        ];
        askAi(recent);
      }
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async (url: string) => {
    await insertMsg("🎤 voice note", { audio_url: url });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      /* no-op */
    }
  };

  const callAiNow = () => askAi(msgs);

  if (loading || !user)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;

  const ar = lang === "ar";

  return (
    <div className="flex min-h-screen flex-col" dir={ar ? "rtl" : "ltr"}>
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-11 w-11">
            <Link to="/chat">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base font-bold">{roomName}</h1>
            <p className="text-xs text-muted-foreground">{ar ? "غرفة جماعية مشتركة" : "Shared sync room"}</p>
          </div>
        </div>
        <Button onClick={copyLink} variant="outline" className="h-10 gap-2">
          <Copy className="h-4 w-4" /> {linkCopied ? (ar ? "تم النسخ" : "Copied!") : ar ? "نسخ رابط الدعوة" : "Copy invite link"}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {msgs.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
              {ar
                ? "شارك رابط الدعوة لينضم أصدقاؤك إلى هذه الغرفة."
                : "Share the invite link to bring your friends into this shared room."}
            </p>
          )}
          {msgs.map((m) => {
            const mine = m.user_id === user.id;
            const ai = m.role === "assistant";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2 ${
                    mine
                      ? "brand-gradient text-primary-foreground"
                      : ai
                        ? "bg-[color:var(--vip)]/15 text-foreground"
                        : "bg-card text-card-foreground"
                  }`}
                >
                  <p className="text-xs font-semibold opacity-80">{m.display_name || (ai ? "🤖 AI" : "User")}</p>
                  {m.audio_url ? (
                    <audio src={m.audio_url} controls className="mt-1 h-9 w-full max-w-[240px]" />
                  ) : (
                    m.content && <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  )}
                  {Array.isArray(m.attachments) && m.attachments.map((a, i) => <AttachmentPreview key={i} att={a} />)}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {pending && (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2 text-xs">
            <span className="truncate">📎 {pending.name}</span>
            <button onClick={() => setPending(null)} className="text-destructive hover:underline">
              {ar ? "إزالة" : "remove"}
            </button>
          </div>
        )}

        <div className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-card/60 p-2 backdrop-blur">
          <AttachmentButton onUploaded={(atts) => setPending(atts[0] ?? null)} disabled={sending} />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.typeMessage}
            disabled={sending}
            className="h-12 flex-1 border-0 bg-transparent text-base focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 shrink-0 border-[color:var(--vip)]/50 text-[color:var(--vip)]"
            onClick={callAiNow}
            title={ar ? "اطلب من الذكاء" : "Ask AI"}
          >
            <Sparkles className="h-5 w-5" />
          </Button>
          <VoiceRecorder onSent={sendVoice} />
          <Button
            onClick={send}
            disabled={sending || (!input.trim() && !pending)}
            className="h-12 w-12 brand-gradient text-primary-foreground"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}
