import { describe, expect, it } from "vitest";
import { vipPricingForTimeZone } from "./vip-pricing";

describe("VIP displayed regional prices", () => {
  it("shows $4.99 monthly and $35.99 yearly in premium regions", () => {
    for (const zone of ["America/New_York", "America/Toronto", "Europe/Paris", "Australia/Sydney", "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "America/Indiana/Indianapolis"]) {
      expect(vipPricingForTimeZone(zone)).toEqual({ monthly: "4.99", yearly: "35.99", algeria: false });
    }
  });
  it("shows $2.49 monthly and $17.99 yearly in Turkey, eastern Europe and Latin America", () => {
    for (const zone of ["Europe/Istanbul", "Europe/Warsaw", "Europe/Bucharest", "America/Sao_Paulo", "America/Mexico_City", "America/Argentina/Buenos_Aires"]) {
      expect(vipPricingForTimeZone(zone)).toEqual({ monthly: "2.49", yearly: "17.99", algeria: false });
    }
  });
  it("shows $1.49 monthly and $9.99 yearly in developing regions", () => {
    expect(vipPricingForTimeZone("Asia/Kolkata")).toEqual({ monthly: "1.49", yearly: "9.99", algeria: false });
  });
  it("includes dinar estimates only for Africa/Algiers", () => {
    expect(vipPricingForTimeZone("Africa/Algiers")).toEqual({ monthly: "1.49", yearly: "9.99", algeria: true });
    expect(vipPricingForTimeZone("Africa/Tunis").algeria).toBe(false);
  });
});