import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcw, Star, UserRound, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarPhotoCrop } from "@/components/AvatarPhotoCrop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AVATAR_COLORS, avatarIdentity, parseAvatarPreference, type AvatarUser, type AvatarPreference, type AvatarColor, type AvatarIcon } from "@/lib/user-avatar";

const CHANGE_EVENT = "belazo-avatar-change";
function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useAvatarPreference(user?: AvatarUser | null) {
  const key = user?.id && !user.is_anonymous ? `belazo-avatar:${user.id}` : null;
  const value = useSyncExternalStore(subscribe, () => {
    try { return key ? window.localStorage.getItem(key) : null; } catch { return null; }
  }, () => null);
  const preference = useMemo(() => parseAvatarPreference(value), [value]);
  const update = (next: AvatarPreference) => {
    if (!key) return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      return true;
    } catch { return false; }
  };
  return { preference, update };
}

export function UserAvatar({ user, className }: { user?: AvatarUser | null; className?: string }) {
  const identity = avatarIdentity(user);
  const { preference } = useAvatarPreference(user);
  const color = identity.guest ? identity.color : preference.color ?? identity.color;
  const icon = identity.guest ? "initials" : preference.icon;
  return (
    <span role="img" aria-label={identity.guest ? "Guest avatar" : `User avatar ${identity.initials}`} dir="ltr"
      className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold leading-none", AVATAR_COLORS[color], className)}>
      {!identity.guest && preference.photo ? <img src={preference.photo} alt="" className="h-full w-full object-cover" /> : icon === "user" ? <UserRound className="h-4 w-4" aria-hidden="true" /> : icon === "star" ? <Star className="h-4 w-4" aria-hidden="true" /> : identity.initials}
    </span>
  );
}

export function AvatarSettings({ user, lang }: { user: AvatarUser; lang: "en" | "ar" }) {
  const { preference, update } = useAvatarPreference(user);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  if (user.is_anonymous) return null;
  const ar = lang === "ar";
  const colorLabels: Record<AvatarColor, string> = ar
    ? { primary: "الأساسي", vip: "ذهبي", secondary: "داكن", destructive: "أحمر" }
    : { primary: "Primary", vip: "Gold", secondary: "Dark", destructive: "Red" };
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold">{ar ? "الصورة الرمزية" : "Avatar"}</legend>
      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label={ar ? "رفع صورة" : "Upload Photo"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!file.type.startsWith("image/")) { toast.error(ar ? "اختر ملف صورة." : "Choose an image file."); return; }
            const reader = new FileReader();
            reader.onload = () => { if (typeof reader.result === "string") setSource(reader.result); };
            reader.onerror = () => toast.error(ar ? "تعذر قراءة الصورة." : "Could not read this photo.");
            reader.readAsDataURL(file);
          }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />{ar ? "رفع صورة" : "Upload Photo"}</Button>
        {preference.photo && <Button variant="outline" onClick={() => {
          if (!update({ ...preference, photo: undefined })) toast.error(ar ? "تعذر إزالة الصورة." : "Could not remove this photo.");
        }}><Trash2 />{ar ? "إزالة الصورة" : "Remove Photo"}</Button>}
      </div>
      {source && <AvatarPhotoCrop key={source} source={source} ar={ar} onClose={() => setSource(null)} onSave={(photo) => {
        const saved = update({ ...preference, photo });
        if (!saved) toast.error(ar ? "تعذر حفظ الصورة على هذا الجهاز." : "Could not save this photo on this device.");
        return saved;
      }} />}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={ar ? "لون الصورة الرمزية" : "Avatar color"}>
        {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((color) => (
          <Button key={color} variant="ghost" size="icon" title={colorLabels[color]} aria-label={colorLabels[color]}
            aria-pressed={preference.color === color} onClick={() => update({ ...preference, color })}
            className={cn("h-10 w-10 rounded-full border-2", AVATAR_COLORS[color], preference.color === color ? "border-foreground" : "border-transparent")} />
        ))}
        <Button variant="ghost" size="icon" title={ar ? "تلقائي" : "Automatic avatar"} aria-label={ar ? "تلقائي" : "Automatic avatar"}
          onClick={() => update({ photo: preference.photo })}><RotateCcw /></Button>
      </div>
      <div className="flex gap-2" role="group" aria-label={ar ? "رمز الصورة الرمزية" : "Avatar icon"}>
        {(["initials", "user", "star"] as AvatarIcon[]).map((icon) => {
          const label = icon === "initials" ? (ar ? "الأحرف" : "Initials") : icon === "user" ? (ar ? "شخص" : "Person") : (ar ? "نجمة" : "Star");
          return <Button key={icon} variant="outline" size="icon" title={label} aria-label={label}
            aria-pressed={(preference.icon ?? "initials") === icon} onClick={() => update({ ...preference, icon })}
            className={cn((preference.icon ?? "initials") === icon && "border-ring bg-accent")}>
            {icon === "user" ? <UserRound /> : icon === "star" ? <Star /> : <span dir="ltr">{avatarIdentity(user).initials}</span>}
          </Button>;
        })}
      </div>
    </fieldset>
  );
}