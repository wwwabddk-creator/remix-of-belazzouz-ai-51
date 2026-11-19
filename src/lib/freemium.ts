import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { allowanceFor, GUEST_MESSAGE_LIMIT } from "./freemium-rules";
import type { AiTone } from "./freemium-rules";

export { GUEST_MESSAGE_LIMIT, FREE_DAILY_MESSAGE_LIMIT, allowanceFor, toneInstruction } from "./freemium-rules";
export type { AiTone } from "./freemium-rules";
export type QuotaResult = { allowed: boolean; remaining: number | null; is_vip: boolean };

const deviceGuestQuotaKey = "belazo_device_guest_quota";
type DeviceGuestQuota = { fingerprint: string; date: string; count: number };

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return (result >>> 0).toString(36);
}

function deviceFingerprint() {
  const userAgentHash = hash(navigator.userAgent);
  return hash([
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    userAgentHash,
  ].join("|"));
}

function readStoredQuota(value: string | null, fingerprint: string, date: string): DeviceGuestQuota | null {
  if (!value) return null;
  try {
    const quota = JSON.parse(value) as DeviceGuestQuota;
    if (quota.fingerprint !== fingerprint || quota.date !== date || !Number.isInteger(quota.count) || quota.count < 0) return null;
    return { ...quota, count: Math.min(quota.count, GUEST_MESSAGE_LIMIT) };
  } catch {
    return null;
  }
}

function readDeviceGuestCookie() {
  try {
    const value = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${deviceGuestQuotaKey}=`));
    return value ? decodeURIComponent(value.slice(deviceGuestQuotaKey.length + 1)) : null;
  } catch {
    return null;
  }
}

function writeDeviceGuestQuota(quota: DeviceGuestQuota) {
  const value = JSON.stringify(quota);
  try { localStorage.setItem(deviceGuestQuotaKey, value); } catch { /* storage unavailable */ }
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${deviceGuestQuotaKey}=${encodeURIComponent(value)}; Max-Age=86400; Path=/; SameSite=Lax${secure}`;
  } catch { /* cookies unavailable */ }
}

function readDeviceGuestQuota(): DeviceGuestQuota {
  const fingerprint = deviceFingerprint();
  const date = new Date().toISOString().slice(0, 10);
  let localValue: string | null = null;
  try { localValue = localStorage.getItem(deviceGuestQuotaKey); } catch { /* storage unavailable */ }
  const localQuota = readStoredQuota(localValue, fingerprint, date);
  const cookieQuota = readStoredQuota(readDeviceGuestCookie(), fingerprint, date);
  const quota = { fingerprint, date, count: Math.max(localQuota?.count ?? 0, cookieQuota?.count ?? 0) };
  writeDeviceGuestQuota(quota);
  return quota;
}

export function readGuestMessageQuota(): QuotaResult {
  const used = readDeviceGuestQuota().count;
  return { allowed: used < GUEST_MESSAGE_LIMIT, remaining: Math.max(0, GUEST_MESSAGE_LIMIT - used), is_vip: false };
}

export function consumeGuestMessage(): QuotaResult {
  const current = readGuestMessageQuota();
  if (!current.allowed) return current;
  const remaining = current.remaining! - 1;
  const fingerprint = deviceFingerprint();
  const date = new Date().toISOString().slice(0, 10);
  writeDeviceGuestQuota({ fingerprint, date, count: GUEST_MESSAGE_LIMIT - remaining });
  return { allowed: true, remaining, is_vip: false };
}

export async function consumeUserMessage(user: User): Promise<QuotaResult> {
  if (user.is_anonymous) return consumeGuestMessage();
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

export type SavedPersona = { id: string; name: string; content: string; tone: AiTone; customTone?: string };
const personaKey = (userId: string) => `belazzouz.personas.${userId}`;

export function readSavedPersonas(userId: string): SavedPersona[] {
  try {
    const value = JSON.parse(localStorage.getItem(personaKey(userId)) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((p): p is SavedPersona =>
      p && typeof p.id === "string" && typeof p.name === "string" &&
      typeof p.content === "string" && ["formal", "casual", "concise", "detailed", "custom"].includes(p.tone) &&
      (p.customTone === undefined || typeof p.customTone === "string"));
  } catch { return []; }
}

export function writeSavedPersonas(userId: string, personas: SavedPersona[]) {
  try { localStorage.setItem(personaKey(userId), JSON.stringify(personas)); } catch { /* local storage unavailable */ }
}
