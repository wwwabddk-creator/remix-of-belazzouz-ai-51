import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { checkUploadBatch } from "@/lib/client-limits";
import { useAppPrefs } from "@/lib/app-prefs";
import { toast } from "sonner";

export type Attachment = { url: string; name: string; type: string; size: number };

export function AttachmentButton({
  onUploaded,
  disabled,
  isSubscriber = false,
}: {
  onUploaded: (atts: Attachment[]) => void;
  disabled?: boolean;
  isSubscriber?: boolean;
}) {
  const { user } = useAuth();
  const { lang } = useAppPrefs();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const handle = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const list = Array.from(files);
    // Limit only images toward the daily cap
    const imageCount = list.filter((f) => f.type.startsWith("image/")).length;
    const gate = checkUploadBatch(imageCount, isSubscriber, lang);
    if (!gate.ok) { toast.warning(gate.reason); return; }

    setBusy(true);
    try {
      const out: Attachment[] = [];
      for (const file of list) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await supabase.storage
          .from("uploads")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (up.error) { console.error(up.error); continue; }
        const { data } = supabase.storage.from("uploads").getPublicUrl(path);
        out.push({ url: data.publicUrl, name: file.name, type: file.type, size: file.size });
      }
      if (out.length) onUploaded(out);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,application/pdf,*/*"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0"
        onClick={pick}
        disabled={disabled || busy || !user}
        title={isSubscriber ? "Attach files (unlimited)" : "Attach up to 3 images"}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    </>
  );
}
