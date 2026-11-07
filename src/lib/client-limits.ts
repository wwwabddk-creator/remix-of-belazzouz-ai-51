// Client-side daily usage limits + throttle + safety filter + library/memory helpers.

const DAILY_TEXT = 50;
const DAILY_IMAGE = 10;
const DAILY_UPLOAD = 10;
const MAX_UPLOAD_BATCH = 3;
const MIN_INTERVAL_MS = 1200;

type Kind = "text" | "image" | "upload";

function todayKey(kind: Kind) {
  const d = new Date();
  return `belazzouz.limit.${kind}.${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function readCount(kind: Kind): number {
  try { return parseInt(localStorage.getItem(todayKey(kind)) || "0", 10) || 0; } catch { return 0; }
}
function writeCount(kind: Kind, n: number) {
  try { localStorage.setItem(todayKey(kind), String(n)); } catch { /* ignore */ }
}

let lastSendAt = 0;

export function checkAndConsume(_kind: "text" | "image", _lang: "en" | "ar"): { ok: true } | { ok: false; reason: string } {
  // Points / daily limits disabled — unlimited free usage.
  lastSendAt = Date.now();
  return { ok: true };
}

export function checkUploadBatch(
  count: number,
  isSubscriber: boolean,
  lang: "en" | "ar",
): { ok: true } | { ok: false; reason: string } {
  if (count <= 0) return { ok: true };
  if (!isSubscriber && count > MAX_UPLOAD_BATCH) {
    return {
      ok: false,
      reason: lang === "ar"
        ? `يمكنك رفع ${MAX_UPLOAD_BATCH} صور كحد أقصى في المرة. اشترك لرفع غير محدود.`
        : `You can upload up to ${MAX_UPLOAD_BATCH} images at once. Subscribe for unlimited.`,
    };
  }
  if (!isSubscriber) {
    const used = readCount("upload");
    if (used + count > DAILY_UPLOAD) {
      return {
        ok: false,
        reason: lang === "ar"
          ? `الحد اليومي للرفع ${DAILY_UPLOAD} صور (المستخدم: ${used}).`
          : `Daily upload limit is ${DAILY_UPLOAD} images (used: ${used}).`,
      };
    }
    writeCount("upload", used + count);
  }
  return { ok: true };
}

const UNSAFE = [
  /\b(DAN|do\s*anything\s*now|jailbreak|ignore\s+(all\s+)?previous\s+(instructions|rules))\b/i,
  /\b(child|minor|underage)\b.*\b(nude|sexual|porn)\b/i,
  /\b(how\s+to\s+(make|build|synthesize))\b.*\b(bomb|explosive|nerve\s*agent|ricin|sarin)\b/i,
  /\bcsam\b/i,
];
export function isUnsafePrompt(text: string): boolean { return UNSAFE.some((r) => r.test(text)); }
export function safetyRefusal(lang: "en" | "ar") {
  return lang === "ar"
    ? "لا أستطيع المساعدة في هذا الطلب. جرّب صياغة مختلفة وآمنة."
    : "I can't help with that request. Try a different, safer phrasing.";
}

// ---------- Library (images / code / text) ----------
export type LibKind = "image" | "code" | "text";
export type LibItem = { id: string; kind: LibKind; title: string; url?: string; body?: string; createdAt: number };
const LIB_KEY = "belazzouz.library";

export function readLibrary(): LibItem[] {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || "[]"); } catch { return []; }
}
export function writeLibrary(items: LibItem[]) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(items.slice(0, 300))); } catch { /* ignore */ }
}
export function addLibraryItem(item: Omit<LibItem, "id" | "createdAt"> & { id?: string }) {
  const list = readLibrary();
  list.unshift({ id: item.id ?? crypto.randomUUID(), createdAt: Date.now(), ...item });
  writeLibrary(list);
}

// ---------- Memory (remember / forget) ----------
const MEM_KEY = "belazzouz.memory";
export function readMemory(): string[] {
  try { return JSON.parse(localStorage.getItem(MEM_KEY) || "[]"); } catch { return []; }
}
export function writeMemory(items: string[]) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(items.slice(0, 100))); } catch { /* ignore */ }
}
export function rememberFact(fact: string) {
  const f = fact.trim();
  if (!f) return;
  const list = readMemory();
  if (!list.includes(f)) { list.unshift(f); writeMemory(list); }
}
export function forgetFact(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const list = readMemory();
  const next = q === "all" || q === "كل شيء" ? [] : list.filter((x) => !x.toLowerCase().includes(q));
  const removed = list.length - next.length;
  writeMemory(next);
  return removed;
}

/** Parse `/remember ...`, `/forget ...`, `تذكر ...`, `انسَ ...` */
export function parseMemoryCommand(text: string): { kind: "remember" | "forget"; arg: string } | null {
  const m = text.match(/^\/?(remember|forget|تذكر|ا?نسى?|انسَ)\s+([\s\S]+)/i);
  if (!m) return null;
  const verb = m[1].toLowerCase();
  const kind = /forget|نسى?|انس/.test(verb) ? "forget" : "remember";
  return { kind, arg: m[2].trim() };
}
