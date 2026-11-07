import type { Attachment } from "@/components/AttachmentButton";

export function AttachmentPreview({ att }: { att: Attachment }) {
  const isImage = att.type.startsWith("image/");
  const isVideo = att.type.startsWith("video/");
  const isAudio = att.type.startsWith("audio/");
  if (isImage) {
    return (
      <a href={att.url} target="_blank" rel="noreferrer" className="block">
        <img src={att.url} alt={att.name} className="mt-2 max-h-64 w-auto rounded-lg border border-border/30" />
      </a>
    );
  }
  if (isVideo) return <video src={att.url} controls className="mt-2 max-h-64 w-full rounded-lg" />;
  if (isAudio) return <audio src={att.url} controls className="mt-2 h-10 w-full max-w-[260px]" />;
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-xs underline"
    >
      📎 {att.name}
    </a>
  );
}
