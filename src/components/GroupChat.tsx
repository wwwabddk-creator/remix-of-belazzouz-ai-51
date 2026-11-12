import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Users, Plus, ArrowRight } from "lucide-react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { AttachmentButton, type Attachment } from "@/components/AttachmentButton";
import { AttachmentPreview } from "@/components/AttachmentPreview";
import { MessageContent } from "@/components/MessageContent";
import { useServerFn } from "@tanstack/react-start";
import { chatStream } from "@/lib/chat.functions";
import { saveGeneratedContent } from "@/lib/library";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";

type GMsg = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
  audio_url?: string | null;
};

type Room = { id: string; name: string; created_by: string; created_at: string };

export function GroupChat() {
  const { user } = useAuth();
  const { lang } = useAppPrefs();
  const t = T[lang];
  const nav = useNavigate();
  const ar = lang === "ar";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);

  const [msgs, setMsgs] = useState<GMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }).limit(20);
      if (active && r.data) setRooms(r.data as Room[]);
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (active && data) setMsgs(data as GMsg[]);
    })();
    const ch = supabase
      .channel("group_messages_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, (p) => {
        setMsgs((m) => [...m, p.new as GMsg]);
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const createRoom = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const name = ar ? "غرفة BELAZO" : "BELAZO Room";
      const r = await supabase.from("chat_rooms").insert({ name, created_by: user.id }).select("id").single();
      if (r.data) {
        const url = `${window.location.origin}/room/${r.data.id}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* ignore */
        }
        nav({ to: "/room/$roomId", params: { roomId: r.data.id } });
      }
    } finally {
      setCreating(false);
    }
  };

  const displayName = () =>
    ((user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      user?.email?.split("@")[0]) ??
    "User";

  const streamFn = useServerFn(chatStream);

  const send = async () => {
    if ((!input.trim() && !pending) || !user || sending) return;
    setSending(true);
    const content = input.trim() || (pending ? `📎 ${pending.name}` : "");
    setInput("");
    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;
    const audioUrl = pending?.url && pending.type.startsWith("audio/") ? pending.url : null;
    const finalContent =
      pending?.url && !audioUrl ? `${content}\n${pending.url}`.trim() : content;
    await supabase.from("group_messages").insert({
      content: finalContent,
      user_id: user.id,
      display_name: displayName(),
      avatar_url: avatar,
      audio_url: audioUrl,
    });
    setPending(null);
    setSending(false);

    // Auto-respond when user tags @AI or @ai (or Arabic @الذكاء)
    if (/(belazo|بيلازو|بلازو|bellazo|@ai|@الذكاء)/i.test(content)) {
      try {
        const ctx = msgs.slice(-8).map((m) => ({
          role: "user" as const,
          content: `${m.display_name || "User"}: ${m.content}`,
        }));
        const iter = (await streamFn({
          data: {
            messages: [...ctx, { role: "user", content }],
            lang,
          },
        })) as AsyncIterable<{ delta?: string }>;
        let acc = "";
        for await (const c of iter) {
          if (c?.delta) acc += c.delta;
        }
        if (acc) {
          await saveGeneratedContent(acc, content, user.id).catch(() => toast.error(ar ? "تعذر حفظ المحتوى في المكتبة." : "Could not save content to the library."));
          await supabase.from("group_messages").insert({
            content: acc,
            user_id: user.id,
            display_name: "🤖 AI",
            avatar_url: null,
          });
        }
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" /> {ar ? "غرف مشتركة" : "Shared sync rooms"}
          </h3>
          <Button onClick={createRoom} disabled={creating || !user} className="h-10 gap-2 brand-gradient text-primary-foreground">
            <Plus className="h-4 w-4" /> {ar ? "إنشاء رابط دعوة جماعية" : "Create Group Invite Link"}
          </Button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {ar
              ? "لا توجد غرف بعد. اضغط الزر لإنشاء غرفة وارسل الرابط لأصدقائك."
              : "No rooms yet. Tap the button to create one and share the link with friends."}
          </p>
        ) : (
          <ul className="space-y-1">
            {rooms.slice(0, 8).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => nav({ to: "/room/$roomId", params: { roomId: r.id } })}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/30"
                >
                  <span className="truncate">{r.name}</span>
                  <ArrowRight className="h-4 w-4 opacity-60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-border bg-card/40 p-4">
        <h2 className="mb-3 text-base font-bold">{t.groupTitle} · {ar ? "اللوبي" : "Lobby"}</h2>
        <div className="flex-1 space-y-3 overflow-y-auto pr-2">
          {msgs.map((m) => {
            const mine = m.user_id === user?.id;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && m.display_name !== "🤖 AI" && <UserAvatar user={{ id: m.user_id, user_metadata: { full_name: m.display_name } }} />}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? "brand-gradient text-primary-foreground" : "bg-card"}`}>
                  <p className="text-xs opacity-70">{m.display_name || "User"}</p>
                  {m.audio_url ? (
                    <audio src={m.audio_url} controls className="mt-1 h-9 w-full max-w-[240px]" />
                  ) : (
                    <MessageContent content={m.content} role={mine ? "user" : "assistant"} lang={lang} />
                  )}
                </div>
                {mine && m.display_name !== "🤖 AI" && <UserAvatar user={user} />}
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
        <div className="mt-3 flex items-end gap-2">
          <AttachmentButton onUploaded={(atts) => setPending(atts[0] ?? null)} disabled={sending} />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.typeMessage}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            className="h-12 flex-1 text-base"
          />
          <Button onClick={send} disabled={sending || (!input.trim() && !pending)} className="h-12 w-12 brand-gradient text-primary-foreground">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
