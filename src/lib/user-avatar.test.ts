import { describe, expect, it } from "vitest";
import { avatarIdentity, parseAvatarPreference } from "./user-avatar";

describe("initials avatars", () => {
  it("uses the first two uppercase characters of full_name ahead of email", () => {
    expect(avatarIdentity({ email: "other@example.com", user_metadata: { full_name: "  Alice Smith  " } }).initials).toBe("AL");
  });
  it("falls back to the first two email characters", () => {
    expect(avatarIdentity({ email: "wasim@example.com", user_metadata: { full_name: " " } }).initials).toBe("WA");
  });
  it("assigns a concrete repeatable color independent of account ID", () => {
    expect(avatarIdentity({ id: "one", email: "wasim@example.com" }).color).toBe("secondary");
    expect(avatarIdentity({ id: "two", email: "wasim@example.com" }).color).toBe("secondary");
  });
  it("always displays G for absent or anonymous users", () => {
    expect(avatarIdentity(null).initials).toBe("G");
    expect(avatarIdentity({ is_anonymous: true, email: "guest@example.com" }).initials).toBe("G");
  });
  it("keeps a single character and handles Unicode characters", () => {
    expect(avatarIdentity({ user_metadata: { full_name: "Q" } }).initials).toBe("Q");
    expect(avatarIdentity({ user_metadata: { full_name: "وسيم" } }).initials).toBe("وس");
  });
  it("accepts only supported local appearance choices", () => {
    expect(parseAvatarPreference('{"color":"vip","icon":"star"}')).toEqual({ color: "vip", icon: "star" });
    expect(parseAvatarPreference('{"color":"__proto__","icon":"upload"}')).toEqual({ color: undefined, icon: undefined });
    expect(parseAvatarPreference("invalid")).toEqual({});
  });
});