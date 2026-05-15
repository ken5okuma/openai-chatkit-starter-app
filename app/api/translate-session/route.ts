export const runtime = "edge";

const SUPPORTED_LANGUAGES = new Set([
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ru",
  "zh",
  "ja",
  "ko",
  "hi",
  "id",
  "vi",
]);

const CLIENT_SECRET_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";

interface RequestBody {
  targetLanguage?: string;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "Missing OPENAI_API_KEY" }, 500);
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const targetLanguage =
    typeof body.targetLanguage === "string" ? body.targetLanguage : "en";

  if (!SUPPORTED_LANGUAGES.has(targetLanguage)) {
    return json({ error: `Unsupported targetLanguage: ${targetLanguage}` }, 400);
  }

  const upstream = await fetch(CLIENT_SECRET_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        model: "gpt-realtime-translate",
        audio: {
          input: {
            transcription: { model: "gpt-realtime-whisper" },
            noise_reduction: { type: "near_field" },
          },
          output: { language: targetLanguage },
        },
      },
    }),
  });

  const payload = (await upstream.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!upstream.ok) {
    const message =
      (payload?.error as { message?: string } | undefined)?.message ??
      (typeof payload?.error === "string" ? payload.error : null) ??
      `Upstream error ${upstream.status}`;
    return json({ error: message, details: payload }, upstream.status);
  }

  const clientSecret = extractClientSecret(payload);
  if (!clientSecret) {
    return json({ error: "Upstream did not return a client_secret" }, 502);
  }

  return json({ client_secret: clientSecret, expires_at: payload?.expires_at });
}

function extractClientSecret(
  payload: Record<string, unknown> | null
): string | null {
  if (!payload) return null;
  const raw = payload.client_secret;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const value = (raw as { value?: unknown }).value;
    if (typeof value === "string") return value;
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
