// Reactive gradient orb: idle morphs colors slowly; when `active`, vibrates
// and scales with the live audio energy provided via `level` (0..1).
export function SpeakingOrb({
  active,
  level = 0,
  size = 28,
}: {
  active: boolean;
  level?: number;
  size?: number;
}) {
  const clamped = Math.min(1, Math.max(0, level));
  const scale = active ? 1 + clamped * 0.45 : 1;
  const glow = active ? 14 + clamped * 36 : 6;
  const sat = active ? 1.1 + clamped * 0.8 : 0.6;
  const hueShift = active ? clamped * 60 : 0;
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full align-middle transition-transform duration-75 ease-out ${
        active ? "speaking-orb-active" : "speaking-orb-idle"
      }`}
      style={{
        width: size,
        height: size,
        transform: `scale(${scale})`,
        background:
          "conic-gradient(from var(--orb-a, 0deg), #6ee7ff, #a78bfa, #f472b6, #facc15, #4ade80, #6ee7ff)",
        boxShadow: `0 0 ${glow}px rgba(167,139,250,.55)`,
        filter: `saturate(${sat}) hue-rotate(${hueShift}deg)`,
      }}
    />
  );
}
