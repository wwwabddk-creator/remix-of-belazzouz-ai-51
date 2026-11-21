import { supabase } from "@/integrations/supabase/client";

type ChatInput = {
  messages: { role: "user" | "assistant"; content: string }[];
  lang?: "en" | "ar";
  weather?: string;
  persona?: string;
  mode?: "fast" | "deep" | "hybrid";
  webContext?: string;
  webConfidence?: number;
  webProviders?: string[];
};

export async function* chatStream({ data, signal }: { data: ChatInput; signal?: AbortSignal }): AsyncGenerator<{ delta: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again.");
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(data),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(await response.text() || "Chat request failed.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += value ?? "";
      const lines = buffer.split("\n");
      buffer = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        const event = JSON.parse(payload);
        const parts = event.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) if (typeof part.text === "string" && !part.thought) yield { delta: part.text };
        }
        if (event.error) throw new Error("Gemini could not generate a response.");
      }
      if (done) break;
    }
  } finally {
    await reader.cancel();
  }
}
