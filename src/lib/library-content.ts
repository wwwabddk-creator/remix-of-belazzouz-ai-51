export type LibKind = "image" | "code" | "text";
export type LibItem = { id: string; kind: LibKind; title: string; url?: string; body?: string; createdAt: number };
export type LibraryDraft = Omit<LibItem, "id" | "createdAt">;

/** Save each fenced code block separately, with any accompanying prose as text. */
export function classifyGeneratedContent(content: string, title: string): LibraryDraft[] {
  const items: LibraryDraft[] = [];
  const prose = content.replace(/(^|\n)[ \t]*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n[ \t]*\2[ \t]*(?=\n|$)/g,
    (_match, _prefix: string, _fence: string, language: string, body: string) => {
      if (body.trim()) items.push({ kind: "code", title: `${title.slice(0, 60)}${language.trim() ? ` · ${language.trim()}` : ""}`, body: body.trim() });
      return "\n";
    }).trim();
  if (prose) items.push({ kind: "text", title: title.slice(0, 60), body: prose });
  return items;
}

export function filterLibrary(items: LibItem[], filter: "all" | LibKind): LibItem[] {
  return items.filter((item) => filter === "all" || item.kind === filter);
}