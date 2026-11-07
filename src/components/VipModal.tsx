import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";

export function VipModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { lang } = useAppPrefs();
  const t = T[lang];
  const ar = lang === "ar";

  const Tier = ({ title, price, period, desc }: { title: string; price: string; period: string; desc: string }) => (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--vip)]/40 bg-card/70 p-5">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-[color:var(--vip)]" />
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-4xl font-extrabold brand-text">{price}</span>
        <span className="pb-1 text-sm text-muted-foreground">/ {period}</span>
      </div>
      <ul className="space-y-1.5 text-sm">
        {desc.split(" · ").map((line) => (
          <li key={line} className="flex items-center gap-2"><Check className="h-4 w-4 text-[color:var(--vip)]" />{line}</li>
        ))}
      </ul>
      <Button disabled className="h-12 brand-gradient text-primary-foreground opacity-80">
        {ar ? "قريباً" : "Coming soon"}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-[color:var(--vip)]" /> {t.vipTitle}
          </DialogTitle>
          <DialogDescription>{t.vipMockNote}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tier title={t.vipWeekly} price="$1" period={ar ? "أسبوع" : "week"} desc={t.vipWeeklyDesc} />
          <Tier title={t.vipMonthly} price="$7" period={ar ? "شهر" : "month"} desc={t.vipMonthlyDesc} />
        </div>
      </DialogContent>
    </Dialog>
  );
}