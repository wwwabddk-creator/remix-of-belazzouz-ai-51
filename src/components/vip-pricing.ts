export type VipPlan = "monthly" | "yearly";
export type VipPricing = { monthly: string; yearly: string; algeria: boolean };

// Time zones are a display hint, not verified billing location.
const premiumEurope = new Set([
  "Amsterdam", "Andorra", "Athens", "Berlin", "Brussels", "Busingen", "Copenhagen",
  "Dublin", "Gibraltar", "Guernsey", "Helsinki", "Isle_of_Man", "Jersey", "Lisbon",
  "London", "Luxembourg", "Madrid", "Malta", "Monaco", "Oslo", "Paris", "Rome",
  "San_Marino", "Stockholm", "Vaduz", "Vatican", "Vienna", "Zurich",
]);
const premiumAmerica = new Set([
  "New_York", "Detroit", "Chicago", "Denver", "Boise", "Phoenix", "Los_Angeles",
  "Anchorage", "Juneau", "Sitka", "Metlakatla", "Yakutat", "Nome", "Adak",
  "Toronto", "Vancouver", "Montreal", "Halifax", "Glace_Bay", "Moncton", "Goose_Bay",
  "St_Johns", "Winnipeg", "Regina", "Swift_Current", "Edmonton", "Whitehorse",
  "Dawson", "Dawson_Creek", "Fort_Nelson", "Creston", "Yellowknife", "Inuvik",
  "Iqaluit", "Resolute", "Cambridge_Bay", "Rankin_Inlet", "Atikokan", "Thunder_Bay",
  "Nipigon", "Rainy_River", "Pangnirtung",
]);
const gulfZones = new Set(["Asia/Dubai", "Asia/Muscat", "Asia/Riyadh", "Asia/Qatar", "Asia/Bahrain", "Asia/Kuwait"]);

export function vipPricingForTimeZone(timeZone: string): VipPricing {
  const [region, city] = timeZone.split("/");
  const premium = region === "Australia" || gulfZones.has(timeZone) ||
    timeZone === "Pacific/Honolulu" || timeZone === "Atlantic/Reykjavik" ||
    timeZone === "Atlantic/Canary" || timeZone === "Atlantic/Madeira" || timeZone === "Atlantic/Azores" ||
    (region === "Europe" && premiumEurope.has(city)) ||
    (region === "America" && (premiumAmerica.has(city) || city === "Indiana" || city === "Kentucky" || city === "North_Dakota")) ||
    /^(US|Canada)\//.test(timeZone);
  if (premium) return { monthly: "4.99", yearly: "35.99", algeria: false };
  if (region === "Europe" || region === "America" || timeZone === "Asia/Istanbul" || timeZone === "Turkey") {
    return { monthly: "2.49", yearly: "17.99", algeria: false };
  }
  return { monthly: "1.49", yearly: "9.99", algeria: timeZone === "Africa/Algiers" };
}