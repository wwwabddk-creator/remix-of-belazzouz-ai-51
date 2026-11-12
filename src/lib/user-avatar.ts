export type AvatarUser = {
  id?: string;
  email?: string;
  is_anonymous?: boolean;
  user_metadata?: { full_name?: unknown };
};

export const AVATAR_COLORS = {
  primary: "bg-primary text-primary-foreground",
  vip: "bg-vip text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;
export type AvatarIcon = "initials" | "user" | "star";
export type AvatarPreference = { color?: AvatarColor; icon?: AvatarIcon };

export function avatarIdentity(user?: AvatarUser | null) {
  if (!user || user.is_anonymous) return { initials: "G", color: "secondary" as AvatarColor, guest: true };
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const source = name || user.email?.trim() || "User";
  const initials = Array.from(source).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (const character of source) hash = (Math.imul(hash, 31) + (character.codePointAt(0) ?? 0)) >>> 0;
  const colors = Object.keys(AVATAR_COLORS) as AvatarColor[];
  return { initials, color: colors[hash % colors.length], guest: false };
}

export function parseAvatarPreference(value: string | null): AvatarPreference {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    return {
      color: typeof record.color === "string" && Object.hasOwn(AVATAR_COLORS, record.color) ? record.color as AvatarColor : undefined,
      icon: record.icon === "user" || record.icon === "star" || record.icon === "initials" ? record.icon : undefined,
    };
  } catch { return {}; }
}