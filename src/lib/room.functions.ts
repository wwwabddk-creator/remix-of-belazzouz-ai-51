import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  roomId: z.string().uuid(),
  lang: z.enum(["en", "ar"]).default("en"),
  persona: z.string().max(500).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        name: z.string().max(120).optional(),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(30),
});

export const roomAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "Missing LOVABLE_API_KEY" };

    const sys =
      data.lang === "ar"
        ? "أنت BELAZO في غرفة محادثة جماعية. أجب بإيجاز شديد ومباشرة (جملة أو جملتين كحد أقصى). لا مقدمات ولا اعتذارات. خاطب العضو باسمه عند المناسبة."
        : "You are BELAZO in a group chat room. Reply very briefly and directly (max 1–2 sentences). No preamble, no apologies. Address the member by name when natural.";
    const persona = data.persona
      ? data.lang === "ar"
        ? `\n\nالمستخدم الذي يتحدث معك وصف نفسه: "${data.persona}". اضبط أسلوبك ليناسب هذه الشخصية تماماً.`
        : `\n\nThe active member described themselves: "${data.persona}". You MUST adapt your tone, vocabulary, and technical depth to match this persona.`
      : "";

    const messages = [
      { role: "system" as const, content: sys + persona },
      ...data.history.map((m) => ({
        role: m.role,
        content: m.name && m.role === "user" ? `${m.name}: ${m.content}` : m.content,
      })),
    ];

    let text = "";
    if (key) {
      try {
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
        });
        if (upstream.ok) {
          const json = await upstream.json();
          text = json?.choices?.[0]?.message?.content ?? "";
        }
      } catch { /* fall through */ }
    }
    if (!text.trim()) {
      // Free fallback brain (no API key)
      for (const model of ["openai", "openai-large", "mistral", "llama"]) {
        try {
          const r = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, referrer: "belazo" }),
          });
          if (!r.ok) continue;
          const j = await r.json().catch(() => null);
          const t: string =
            j?.choices?.[0]?.message?.content ??
            j?.message?.content ??
            (typeof j === "string" ? j : "");
          if (t && t.trim()) { text = t; break; }
        } catch { /* try next */ }
      }
    }
    if (!text.trim()) return { ok: false as const, error: "Empty reply" };


    const { error } = await supabaseAdmin.from("chat_room_messages").insert({
      room_id: data.roomId,
      user_id: null,
      role: "assistant",
      display_name: "🤖 BELAZO",
      content: text,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
