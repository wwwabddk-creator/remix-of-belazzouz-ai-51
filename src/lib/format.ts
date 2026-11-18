// Strip Markdown noise from streamed AI text and produce themed HTML segments.
// Removes: **, __, *, _, `, #, >, ---, bullet hyphens, [text](url) -> text.
// Keeps line breaks. Detects "Title:" lines and wraps them as themed strong tags.

export function stripMarkdown(input: string): string {
  if (!input) return "";
  let s = input;
  // Code fences -> keep inner text
  s = s.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, "$1");
  // Inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1$2");
  // Headings, blockquotes, hr
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s*---+\s*$/gm, "");
  // Bullet markers -> "• "
  s = s.replace(/^\s*[-*+]\s+/gm, "• ");
  // Numbered lists keep as-is (e.g. "1. ")
  // Collapse 3+ blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function cleanHistoryText(input: string): string {
  return stripMarkdown(input.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n?/g, "\n"));
}

// Render plain text with themed titles. Splits on lines; lines that look like
// "Title:" (short, ends with colon) become bold/primary-colored.
// Returns React-ready segments as { type, text }[].
export type FormattedSegment =
  | { kind: "title"; text: string }
  | { kind: "text"; text: string }
  | { kind: "br" };

export function formatForRender(input: string): FormattedSegment[] {
  const clean = stripMarkdown(input);
  const lines = clean.split("\n");
  const out: FormattedSegment[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const isTitle =
      trimmed.length > 0 &&
      trimmed.length <= 80 &&
      /[:：]\s*$/.test(trimmed) &&
      !trimmed.startsWith("•");
    if (isTitle) out.push({ kind: "title", text: trimmed.replace(/[:：]\s*$/, "") });
    else if (trimmed.length === 0) out.push({ kind: "br" });
    else out.push({ kind: "text", text: line });
    if (i < lines.length - 1) out.push({ kind: "br" });
  });
  return out;
}
