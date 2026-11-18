import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Infinity, Users, Download, Brain, ImagePlus, Zap, PanelsTopLeft, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { vipPricingForTimeZone, type VipPlan } from "./vip-pricing";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { toast } from "sonner";

export function VipModal({ open, onOpenChange, isVip = false }: { open: boolean; onOpenChange: (v: boolean) => void; isVip?: boolean }) {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const ar = lang === "ar";
  const [plan, setPlan] = useState<VipPlan>("monthly");
  const [pricing, setPricing] = useState<ReturnType<typeof vipPricingForTimeZone> | null>(null);
  useEffect(() => {
    try { setPricing(vipPricingForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)); }
    catch { setPricing(vipPricingForTimeZone("")); }
  }, []);
  const perks = [
    { Icon: Infinity, text: ar ? "رسائل يومية غير محدودة" : "Unlimited daily messages", detail: ar ? "محادثات بلا قيود أو توقف." : "Conversations without daily limits." },
    { Icon: Brain, text: ar ? "ذاكرة ذكية دائمة" : "Persistent smart memory", detail: ar ? "يتذكر معلوماتك وتفضيلاتك المحفوظة، حتى في المحادثات الجديدة." : "Remembers saved facts and preferences, even in new chats." },
    { Icon: ImagePlus, text: ar ? "توليد حتى 10 صور يومياً" : "Up to 10 images daily", detail: ar ? "إنشاء صور احترافية فائقة الجودة." : "Create high-quality professional images." },
    { Icon: Globe, text: ar ? "بحث مباشر على الإنترنت" : "Live Web Search", detail: ar ? "جلب الأخبار والمعلومات والأسعار اللحظية من الويب." : "Fetch real-time news, information and prices from the web.", upcoming: true },
    { Icon: Zap, text: ar ? "سرعة وأولوية قصوى" : "Maximum speed & priority", detail: ar ? "استجابة فورية بدون انتظار." : "Instant responses without waiting." },
    { Icon: Users, text: ar ? "شخصيات AI غير محدودة ونغمات رد مخصصة" : "Unlimited saved AI personas & custom response tones" },
    { Icon: PanelsTopLeft, text: ar ? "معاينة حية وألعاب مصغرة تفاعلية (Canvas)" : "Live previews & interactive mini-games (Canvas)", upcoming: true },
    { Icon: Download, text: ar ? "تصدير سجل المحادثات كاملاً" : "Export full chat history", detail: "Word · PDF · Excel" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="vip-dialog max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg gap-5 p-5 sm:p-7" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader className="items-center space-y-2 pt-2">
          <div className="vip-emblem mb-1 flex h-12 w-12 items-center justify-center rounded-full text-vip"><Crown className="h-6 w-6" /></div>
          <DialogTitle className="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold tracking-normal" dir="ltr">
            <span className="vip-gold-text">BELAZO · VIP</span><span className="vip-pro rounded px-2 py-1 text-[10px] font-bold">PRO</span>
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            {ar ? "تجربة أرقى. إمكانيات أكبر. بطابعك أنت." : "An elevated experience. More possibilities. Uniquely yours."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <div className="vip-plan-toggle grid grid-cols-[0.8fr_1.6fr] gap-1 rounded-full p-1" role="group" aria-label={ar ? "مدة الاشتراك" : "Billing period"}>
            <Button variant="ghost" aria-pressed={plan === "monthly"} onClick={() => setPlan("monthly")} className="vip-plan rounded-full px-2 text-xs">{ar ? "شهري" : "Monthly"}</Button>
            <Button variant="ghost" aria-pressed={plan === "yearly"} onClick={() => setPlan("yearly")} className="vip-plan rounded-full px-2 text-xs">{ar ? "سنوي — وفر حتى 45% 🔥" : "Yearly — save up to 45% 🔥"}</Button>
          </div>
          <div aria-live="polite" className="min-h-20">
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
              <span className="text-4xl font-bold text-foreground" dir="ltr">{pricing ? `$${pricing[plan]}` : "—"}</span>
              <span className="text-sm text-muted-foreground">{plan === "monthly" ? (ar ? "/ شهر" : "/ month") : (ar ? "/ سنة" : "/ year")}</span>
              {pricing?.algeria && <span className="text-xs text-vip">{plan === "monthly" ? "~300 دج" : "~2000 دج"}</span>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{ar ? "سعر مخصص تلقائياً حسب بلدك 🌍" : "Pricing automatically tailored to your country 🌍"}</p>
          </div>
        </div>
        <ul className="vip-perks space-y-3 rounded-lg p-4">
          {perks.map(({ Icon, text, detail, upcoming }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-vip" />
              <span className="min-w-0 flex-1"><span className="font-medium leading-5">{text}</span>{detail && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span>}</span>
              {upcoming ? <span className="shrink-0 pt-1 text-[10px] text-vip">{ar ? "قريباً" : "Soon"}</span> : <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-vip" />}
            </li>
          ))}
        </ul>
        <Button
          disabled={isVip}
          onClick={() => toast.info(ar ? "الدفع غير مربوط بعد. ستتوفر الترقية قريباً." : "Checkout is not connected yet. VIP upgrades will be available soon.")}
          className="vip-subscribe h-12 w-full whitespace-normal text-sm font-bold"
        >
          <Crown className="h-5 w-5" />
          {isVip ? (ar ? "اشتراك VIP مفعل ✓" : "VIP membership active ✓") : (ar ? "الترقية إلى VIP الآن" : "Upgrade to VIP now")}
        </Button>
        {!isVip && <p className="text-center text-[11px] leading-5 text-muted-foreground">{t.vipMockNote}</p>}
      </DialogContent>
    </Dialog>
  );
}
