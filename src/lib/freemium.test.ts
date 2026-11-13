import { describe, expect, it } from "vitest";
import { allowanceFor, GUEST_MESSAGE_LIMIT, FREE_DAILY_MESSAGE_LIMIT, toneInstruction } from "./freemium";

describe("freemium rules", () => {
  it("allows exactly five total guest messages", () => {
    expect(GUEST_MESSAGE_LIMIT).toBe(5);
    expect(allowanceFor(4, GUEST_MESSAGE_LIMIT)).toEqual({ allowed: true, remaining: 1 });
    expect(allowanceFor(5, GUEST_MESSAGE_LIMIT)).toEqual({ allowed: false, remaining: 0 });
  });

  it("allows exactly 25 free registered messages before the daily reset", () => {
    expect(FREE_DAILY_MESSAGE_LIMIT).toBe(25);
    expect(allowanceFor(24, FREE_DAILY_MESSAGE_LIMIT)).toEqual({ allowed: true, remaining: 1 });
    expect(allowanceFor(25, FREE_DAILY_MESSAGE_LIMIT)).toEqual({ allowed: false, remaining: 0 });
  });

  it("provides all four VIP response tones", () => {
    expect(["formal", "casual", "concise", "detailed"].map((tone) => toneInstruction(tone as Parameters<typeof toneInstruction>[0])))
      .toEqual([
        "Use a polished, professional, formal response tone.",
        "Use a warm, relaxed, conversational response tone.",
        "Be concise: answer directly with only essential details.",
        "Be detailed: explain thoroughly with useful context and examples.",
      ]);
  });
});
