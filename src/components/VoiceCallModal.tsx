import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff } from "lucide-react";

type SR = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

export function VoiceCallModal({
  open,
  onOpenChange,
  lang,
  onAsk,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lang: "en" | "ar";
  onAsk: (q: string) => Promise<string>;
}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const recRef = useRef<unknown>(null);

  useEffect(() => {
    if (!open) return;
    const W = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Ctor = (W.SpeechRecognition || W.webkitSpeechRecognition) as
      | (new () => {
          lang: string;
          continuous: boolean;
          interimResults: boolean;
          onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void;
          onend: () => void;
          start: () => void;
          stop: () => void;
        })
      | undefined;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang === "ar" ? "ar-SA" : "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = async (e) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.trim();
      if (!text) return;
      setTranscript(text);
      if (/(باي|اغلق الاتصال|bye|hang up|end call)/i.test(text)) {
        onOpenChange(false);
        return;
      }
      const ans = await onAsk(text);
      setReply(ans);
      speak(ans);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { /* ignore */ }
    return () => {
      try { (rec as { stop: () => void }).stop(); } catch { /* ignore */ }
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    };
  }, [open, lang, onAsk, onOpenChange]);

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ar" ? "ar-SA" : "en-US";
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    synth.speak(u);
  };

  const toggleMic = () => {
    const r = recRef.current as { start: () => void; stop: () => void } | null;
    if (!r) return;
    if (listening) { r.stop(); setListening(false); } else { try { r.start(); setListening(true); } catch { /* ignore */ } }
  };

  const hangUp = () => { window.speechSynthesis?.cancel(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950 p-0 text-white">
        <div className="flex flex-col items-center gap-6 p-8">
          <div className="relative">
            <div
              className={`flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_60px_rgba(139,92,246,0.6)] transition-transform ${speaking ? "animate-pulse scale-105" : "scale-100"}`}
              style={{ filter: speaking ? "saturate(1.4)" : "saturate(1)" }}
            >
              <span className="text-6xl">🤖</span>
            </div>
            <div className={`absolute inset-x-1/2 bottom-6 -translate-x-1/2 h-2 rounded-full bg-white/80 transition-all ${speaking ? "w-16 animate-[ping_0.6s_infinite]" : "w-6"}`} />
          </div>
          <p className="text-center text-sm opacity-80 min-h-[2em]">{transcript || (lang === "ar" ? "تحدث الآن…" : "Speak now…")}</p>
          <p className="text-center text-base font-medium min-h-[2em]">{reply}</p>
          <div className="flex gap-4">
            <Button size="icon" variant="secondary" className="h-14 w-14 rounded-full" onClick={toggleMic}>
              {listening ? <Mic className="h-6 w-6 text-emerald-400" /> : <MicOff className="h-6 w-6" />}
            </Button>
            <Button size="icon" className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700" onClick={hangUp}>
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
          <p className="text-xs opacity-60">{lang === "ar" ? "قل «باي» لإنهاء المكالمة" : "Say \"bye\" to end the call"}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
