import { useState } from "react";
import { Copy, Check, Volume2, VolumeX, MoreHorizontal, ThumbsUp, ThumbsDown, Maximize2, Minimize2 } from "lucide-react";
import { formatForRender } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";


function pickDefaultVoice(targetLang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const langPrefix = targetLang.slice(0, 2);
  const malePatterns = /(male|david|alex|fred|aaron|daniel|tom|george|james|majed|hamed|hamza|naayf|naayef|deep|bass)/i;
  const femalePatterns = /(female|samantha|victoria|karen|tessa|monica|paulina|laila|maha|hala|amira|zira)/i;
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = sameLang.length ? sameLang : voices;
  return pool.find((v) => malePatterns.test(v.name)) || pool.find((v) => !femalePatterns.test(v.name)) || pool[0];
}

function speak(text: string, lang: "en" | "ar") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ar" ? "ar-SA" : "en-US";
  u.rate = 1.0;
  u.pitch = 0.85;
  const v = pickDefaultVoice(u.lang);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {/* ignore */}
  };
  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/40 px-3 py-1 text-xs">
        <span className="opacity-60">{language || "code"}</span>
        <button onClick={onCopy} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-background/60" title="Copy code">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
    </div>
  );
}

function splitFences(input: string): Array<{ kind: "text"; value: string } | { kind: "code"; value: string; lang?: string }> {
  const parts: Array<{ kind: "text"; value: string } | { kind: "code"; value: string; lang?: string }> = [];
  const re = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: input.slice(last, m.index) });
    parts.push({ kind: "code", lang: m[1] || undefined, value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < input.length) parts.push({ kind: "text", value: input.slice(last) });
  return parts.length ? parts : [{ kind: "text", value: input }];
}

export function MessageContent({
  content, role, lang, onFollowUp,
}: {
  content: string; role: "user" | "assistant"; lang: "en" | "ar"; onFollowUp?: (instruction: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const parts = splitFences(content);

  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {/* ignore */}
  };

  const toggleSpeak = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    speak(content.replace(/```[\s\S]*?```/g, ""), lang);
    setSpeaking(true);
    const tick = setInterval(() => {
      if (!window.speechSynthesis.speaking) { setSpeaking(false); clearInterval(tick); }
    }, 350);
  };

  return (
    <div className="group/msg relative">
      <div className="leading-relaxed">
        {parts.map((p, idx) =>
          p.kind === "code" ? (
            <CodeBlock key={idx} code={p.value} language={p.lang} />
          ) : (
            <span key={idx}>
              {formatForRender(p.value).map((seg, i) => {
                if (seg.kind === "br") return <br key={i} />;
                if (seg.kind === "title")
                  return <span key={i} className="my-1 inline-block font-bold text-[color:var(--primary)]">{seg.text}</span>;
                return <span key={i}>{seg.text}</span>;
              })}
            </span>
          ),
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 opacity-60 transition-opacity group-hover/msg:opacity-100">
        
        <button type="button" onClick={copy} aria-label="Copy" className="rounded-md p-1 hover:bg-background/40" title="Copy">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {role === "assistant" && (
          <>
            <button type="button" onClick={toggleSpeak} aria-label="Speak" className="rounded-md p-1 hover:bg-background/40" title={speaking ? "Stop" : "Speak"}>
              {speaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-md p-1 hover:bg-background/40" title="More" aria-label="More options">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => { setVote("up"); toast.success(lang === "ar" ? "شكراً للتقييم" : "Thanks for the feedback"); }}>
                  <ThumbsUp className="me-2 h-4 w-4" /> {lang === "ar" ? "إعجاب" : "Upvote"} {vote === "up" ? "✓" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setVote("down"); toast(lang === "ar" ? "تم تسجيل الملاحظة" : "Noted"); }}>
                  <ThumbsDown className="me-2 h-4 w-4" /> {lang === "ar" ? "عدم إعجاب" : "Downvote"} {vote === "down" ? "✓" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const issue = window.prompt(lang === "ar" ? "صف المشكلة:" : "Describe the issue:");
                  if (issue) toast.success(lang === "ar" ? "تم إرسال البلاغ محلياً" : "Issue logged locally");
                }}>
                  {lang === "ar" ? "الإبلاغ عن مشكلة" : "Report issue"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onFollowUp?.(lang === "ar" ? "اجعل الرد أطول وأكثر تفصيلاً" : "Make the previous reply longer and more detailed.")}>
                  <Maximize2 className="me-2 h-4 w-4" /> {lang === "ar" ? "اجعله أطول" : "Make longer"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFollowUp?.(lang === "ar" ? "اجعل الرد أقصر وأكثر اختصاراً" : "Make the previous reply shorter and more concise.")}>
                  <Minimize2 className="me-2 h-4 w-4" /> {lang === "ar" ? "اجعله أقصر" : "Make shorter"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
