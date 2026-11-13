export const GUEST_MESSAGE_LIMIT = 5;
export const FREE_DAILY_MESSAGE_LIMIT = 25;

export type AiTone = "formal" | "casual" | "concise" | "detailed";

export function allowanceFor(count: number, limit: number) {
  const used = Math.max(0, Math.floor(count));
  return { allowed: used < limit, remaining: Math.max(0, limit - used) };
}

export function toneInstruction(tone: AiTone) {
  const instructions: Record<AiTone, string> = {
    formal: "Use a polished, professional, formal response tone.",
    casual: "Use a warm, relaxed, conversational response tone.",
    concise: "Be concise: answer directly with only essential details.",
    detailed: "Be detailed: explain thoroughly with useful context and examples.",
  };
  return instructions[tone];
}
