This is a large 8-feature upgrade. Before I start writing code, I want to confirm scope and surface a few decisions that will block progress later.

## Current state (already in the project)

- Supabase Auth with `persistSession: true` + `autoRefreshToken: true` → **session already persists permanently** until manual logout. No change needed beyond confirming logout flow.
- Chat history persisted in `conversations` + `messages` tables (with RLS). Group rooms in `chat_rooms` + `chat_room_messages`.
- Persona input (`PersonaInput.tsx`) already injects persona into system prompt via `chat.functions.ts`.
- Web-search verification pipeline already wired (previous turn).
- Image generation/edit via Lovable AI Gateway (Gemini image models) — free, no key needed.
- Voice recorder component exists (`VoiceRecorder.tsx`).
- Streaming chat already implemented via `createServerFn` async generator.

## What actually needs building

### 1. Session persistence ✅ already done
Just verify Logout button calls `supabase.auth.signOut()`. No code change expected.

### 2. Persona routing ✅ already done
Already injected. Will verify and strengthen the system-prompt template.

### 3. Markdown stripping + Copy button + themed titles
- Add a `stripMarkdown()` utility (regex) applied to assistant message content before render.
- Render with `<br/>` for line breaks; wrap detected "Title:" lines in themed `<strong class="text-primary">`.
- Add a Copy icon button to every message bubble (user + AI) using `navigator.clipboard.writeText`.

### 4. Geolocation → State/Municipality via Nominatim
- New `useGeolocation` hook + small `LocationBadge` component.
- Calls `navigator.geolocation.getCurrentPosition` → `https://nominatim.openstreetmap.org/reverse?...&format=json` → display `address.state` / `address.county` / `address.municipality` (Arabic when `accept-language=ar`).

### 5. Group chat realtime
- Already have rooms & messages. Add Supabase Realtime subscription on `chat_room_messages` (no Socket.io — Supabase Realtime is the free, built-in option on this stack).
- Add `@AI` mention detection → trigger assistant response server-fn that inserts an assistant row into the room.

### 6. Voice (STT + TTS + VAD)
- **STT:** Groq Whisper requires `GROQ_API_KEY` (free tier, user must create account). I'll request the secret.
- **TTS:** Hugging Face Space for Kokoro is unreliable/cold-starts heavily on free tier. **Recommendation:** use browser `SpeechSynthesis` API (free, instant, offline, supports male voice selection) as primary, with HF Space as opt-in fallback. Confirm?
- **VAD:** simple RMS-based silence detection on MediaRecorder stream (1.5s threshold) — no library needed.

### 7. Image inpainting
- Add `react-sketch-canvas` for mask drawing.
- HF Inference API for SDXL inpainting requires `HF_TOKEN` (free tier rate-limited and frequently 503s on cold models). I'll request the secret and add graceful failure messaging.

### 8. Groq LLM streaming
- Migrate chat from Lovable AI Gateway → Groq `llama-3.3-70b-versatile` with `stream: true`.
- **Trade-off:** we lose the free unlimited Lovable AI Gateway. Groq free tier has daily token limits (~14.4k req/day, 6k tokens/min). Are you OK with that, or should we keep Lovable AI Gateway (also streaming, also fast) as the primary and only use Groq as fallback?

## Questions blocking implementation

1. **Groq vs Lovable AI Gateway for chat** — Lovable AI is already streaming, free, and has no daily cap on workspace credits. Groq is faster TTFT but has hard daily limits. Keep Lovable AI primary?
2. **TTS** — OK with browser SpeechSynthesis (instant, free, no key, male voice) instead of HF Space (cold starts 20–60s on free tier)?
3. **Secrets needed if you confirm Groq + HF:** `GROQ_API_KEY`, `HF_TOKEN`. I'll request them via the secrets tool once you confirm.

## Implementation order once confirmed

1. Markdown stripper + Copy buttons + themed titles (frontend only)
2. Geolocation hook + badge
3. Group chat Supabase Realtime + @AI mentions
4. VAD + STT (Groq Whisper) + TTS (SpeechSynthesis or HF)
5. Inpainting canvas + HF SDXL
6. Chat LLM migration (Groq or keep Lovable AI)
7. Verify session persistence & persona routing end-to-end

Please answer the two questions above and I'll proceed.