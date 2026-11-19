import { describe, expect, it } from "vitest";
import { canUseMemory, memoryContext, cleanMemoryFacts, limitWords, memoryPoints } from "./memory-rules";

describe("VIP persistent memory", () => {
  it("requires is_vip=true, not merely a signed-in profile", () => {
    expect(canUseMemory({ is_vip: true })).toBe(true);
    expect(canUseMemory({ is_vip: false })).toBe(false);
    expect(canUseMemory(null)).toBe(false);
  });
  it("includes saved facts independently of conversation history", () => {
    expect(memoryContext({ is_vip: true, user_memory: "I prefer Arabic and am building a bookstore." }))
      .toContain("I prefer Arabic and am building a bookstore.");
    expect(memoryContext({ is_vip: false, user_memory: "Private fact" })).toBe("");
  });
  it("stops including memory after it is cleared or null", () => {
    expect(memoryContext({ is_vip: true, user_memory: "" })).toBe("");
    expect(memoryContext({ is_vip: true, user_memory: null })).toBe("");
  });
  it("appends only distinct nonempty extracted facts", () => {
    expect(cleanMemoryFacts([" Prefers Arabic ", "prefers arabic", "", "Building a bookstore"]))
      .toEqual(["Prefers Arabic", "Building a bookstore"]);
  });
});
describe("smart memory limits", () => {
  it("caps memory at 500 words", () => {
    const long = Array.from({ length: 600 }, (_, i) => `w${i}`).join(" ");
    expect(limitWords(long, 500).split(/\s+/).length).toBe(500);
  });
  it("splits memory into deletable points", () => {
    expect(memoryPoints("- Likes tea\n\n• Builds apps")).toEqual(["Likes tea", "Builds apps"]);
  });
});
