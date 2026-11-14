import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { allowanceFor, GUEST_MESSAGE_LIMIT } from "./freemium-rules";
import type { AiTone } from "./freemium-rules";

export { GUEST_MESSAGE_LIMIT, FREE_DAILY_MESSAGE_LIMIT, allowanceFor, toneInstruction } from "./freemium-rules";
export type { AiTone } from "./freemium-rules";
export type QuotaResult = { allowed: boolean; remaining: number | null; is_vip: boolean };

const guestKey = (userId: string) => `belazzouz.guest-messages.${userId}`;

export function consumeGuestMessage(userId: string): QuotaResult {
  try {
    const used = Number.parseInt(localStorage.getItem(guestKey(userId)) || "0", 10) || 0;
    const current = allowanceFor(used, GUEST_MESSAGE_LIMIT);
    if (!current.allowed) return { allowed: false, remaining: 0, is_vip: false };
    localStorage.setItem(guestKey(userId), String(used + 1));
    return { allowed: true, remaining: current.remaining - 1, is_vip: false };
  } catch {
    return { allowed: true, remaining: null, is_vip: false };
  }
}

export async function consumeUserMessage(user: User): Promise<QuotaResult> {
  if (user.is_anonymous) return consumeGuestMessage(user.id);
  const { data, error } = await supabase.rpc("consume_daily_message");
  if (error) throw error;
  return data as unknown as QuotaResult;
}

export async function readVipStatus(user: User): Promise<boolean> {
  if (user.is_anonymous) return false;
  const { data } = await supabase.from("profiles").select("is_vip").eq("id", user.id).maybeSingle();
  return data?.is_vip === true;
}

export function quotaMessage(lang: "en" | "ar", guest: boolean) {
  if (lang === "ar") {
    return guest
      ? "استخدمت رسائلك الخمس المجانية. أنشئ حساباً للحصول على 25 رسالة يومياً."
      : "استخدمت رسائلك الـ25 اليوم. يتجدد رصيدك غداً، أو يمكنك الترقية إلى VIP.";
  }
  return guest
    ? "You used all 5 guest messages. Create an account for 25 messages each day."
    : "You used all 25 messages for today. Your allowance resets tomorrow, or you can upgrade to VIP.";
}

export type SavedPersona = { id: string; name: string; content: string; tone: AiTone };
const personaKey = (userId: string) => `belazzouz.personas.${userId}`;

export function readSavedPersonas(userId: string): SavedPersona[] {
  try {
    const value = JSON.parse(localStorage.getItem(personaKey(userId)) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((p): p is SavedPersona =>
      p && typeof p.id === "string" && typeof p.name === "string" &&
      typeof p.content === "string" && ["formal", "casual", "concise", "detailed"].includes(p.tone));
  } catch { return []; }
}

export function writeSavedPersonas(userId: string, personas: SavedPersona[]) {
  try { localStorage.setItem(personaKey(userId), JSON.stringify(personas)); } catch { /* local storage unavailable */ }
}
