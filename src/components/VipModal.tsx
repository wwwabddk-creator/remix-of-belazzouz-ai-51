import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Infinity, Users, Download } from "lucide-react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { toast } from "sonner";

export function VipModal({ open, onOpenChange, isVip = false }: { open: boolean; onOpenChange: (v: boolean) => void; isVip?: boolean }) {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const ar = lang === "ar";
  const perks = [
    { Icon: Infinity, text: ar ? "رسائل يومية غير محدودة" : "Unlimited daily messages" },
    { Icon: Users, text: ar ? "شخصيات AI غير محدودة ونغمات رد مخصصة" : "Unlimited saved AI personas & custom response tones" },
    { Icon: Download, text: ar ? "حفظ سجل المحادثات كاملاً وتصديره" : "Full chat history saving and export" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-[color:var(--vip)]" /> {t.vipTitle}
          </DialogTitle>
          <DialogDescription>
            {ar ? "خصص تجربتك واحصل على حرية أكبر في المحادثة." : "Personalize your experience and chat without daily limits."}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 rounded-2xl border border-[color:var(--vip)]/40 bg-card/70 p-5">
          {perks.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon className="h-5 w-5 shrink-0 text-[color:var(--vip)]" />
              <span className="flex-1">{text}</span>
              <Check className="h-4 w-4 shrink-0 text-[color:var(--vip)]" />
            </li>
          ))}
        </ul>
        <Button
          disabled={isVip}
          onClick={() => toast.info(ar ? "الدفع غير مربوط بعد. ستتوفر الترقية قريباً." : "Checkout is not connected yet. VIP upgrades will be available soon.")}
          className="h-12 w-full brand-gradient text-primary-foreground"
        >
          <Crown className="h-5 w-5" />
          {isVip ? (ar ? "اشتراك VIP مفعّل" : "VIP is active") : (ar ? "الترقية إلى VIP" : "Upgrade to VIP")}
        </Button>
        {!isVip && <p className="text-center text-xs text-muted-foreground">{t.vipMockNote}</p>}
      </DialogContent>
    </Dialog>
  );
}
