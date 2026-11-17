import { describe, expect, it } from "vitest";
import { enforceImageQuota, VIP_DAILY_IMAGE_LIMIT } from "./image-quota";

describe("VIP daily image limit", () => {
  it("allows the tenth image but blocks the eleventh", () => {
    expect(VIP_DAILY_IMAGE_LIMIT).toBe(10);
    expect(() => enforceImageQuota({ allowed: true, remaining: 0, is_vip: true })).not.toThrow();
    expect(() => enforceImageQuota({ allowed: false, remaining: 0, is_vip: true })).toThrow("10");
  });
  it("preserves non-VIP allowance", () => {
    expect(() => enforceImageQuota({ allowed: true, remaining: null, is_vip: false })).not.toThrow();
  });
  it("fails closed if quota cannot be read", () => {
    expect(() => enforceImageQuota(null)).toThrow();
  });
});