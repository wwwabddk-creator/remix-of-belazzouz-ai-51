export const VIP_DAILY_IMAGE_LIMIT = 10;
export type ImageQuotaResult = { allowed: boolean; remaining: number | null; is_vip: boolean };

export function enforceImageQuota(result: ImageQuotaResult | null) {
  if (!result) throw new Error("تعذر التحقق من رصيد الصور. Could not verify image allowance.");
  if (!result.allowed) throw new Error("استخدمت صورك الـ10 اليوم. يتجدد رصيدك عند منتصف الليل UTC. You used all 10 images today. Your allowance resets at midnight UTC.");
}