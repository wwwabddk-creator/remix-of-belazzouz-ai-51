import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppPrefs } from "@/lib/app-prefs";
import { T } from "@/lib/i18n";
import { SpeakingOrb } from "@/components/SpeakingOrb";

export function VoiceRecorder({ onSent }: { onSent: (publicUrl: string) => Promise<void> | void }) {
  const { user } = useAuth();
  const { lang } = useAppPrefs();
  const t = T[lang];
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);
  const vadRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const cleanupVad = () => {
    if (vadRef.current) { cancelAnimationFrame(vadRef.current); vadRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
  };

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((tr) => tr.stop());
        cleanupVad();
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);

      // VAD: auto-stop after 1.5s of silence (after at least 1s of recording).
      try {
        const AC: typeof AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let silenceStart = performance.now();
        let sawVoice = false;
        const startedAt = performance.now();
        const loop = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(1, rms * 6));
          const now = performance.now();
          if (rms > 0.025) {
            sawVoice = true;
            silenceStart = now;
          }
          if (
            sawVoice &&
            now - startedAt > 1000 &&
            now - silenceStart > 1500 &&
            recRef.current?.state === "recording"
          ) {
            stop();
            return;
          }
          vadRef.current = requestAnimationFrame(loop);
        };
        vadRef.current = requestAnimationFrame(loop);
      } catch {
        /* VAD optional */
      }
    } catch (e) {
      setErr((e as Error).message || "Microphone unavailable");
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    cleanupVad();
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null); setPreviewUrl(null); setElapsed(0);
  };

  const send = async () => {
    if (!blob || !user) return;
    setBusy(true); setErr(null);
    try {
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("audio").upload(path, blob, { contentType: blob.type });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("audio").getPublicUrl(path);
      await onSent(data.publicUrl);
      reset();
    } catch (e) {
      setErr((e as Error).message || "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-2">
      {err && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">{err}</p>}
      {!blob && !recording && (
        <Button type="button" variant="outline" className="h-12" onClick={start} disabled={!user} title={t.record}>
          <Mic className="h-5 w-5" />
        </Button>
      )}
      {recording && (
        <Button type="button" variant="destructive" className="h-12 gap-2" onClick={stop}>
          <SpeakingOrb active level={level} size={18} />
          <Square className="h-4 w-4" /> {elapsed}s
        </Button>
      )}
      {blob && previewUrl && !recording && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 p-2">
          <audio src={previewUrl} controls className="h-9 max-w-[180px]" />
          <Button type="button" size="icon" variant="ghost" onClick={reset} disabled={busy}><X className="h-4 w-4" /></Button>
          <Button type="button" size="icon" className="brand-gradient text-primary-foreground" onClick={send} disabled={busy}><Send className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}