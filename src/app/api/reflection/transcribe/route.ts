import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio file too large (max 10 MB)" }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", file, file.name || "recording.webm");
  body.append("model", "whisper-1");
  body.append("language", "pl");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error("[reflection/transcribe] OpenAI:", response.status, raw.slice(0, 500));
    return NextResponse.json(
      { error: "Transcription failed", status: response.status },
      { status: 502 }
    );
  }

  let data: { text?: string };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return NextResponse.json({ error: "Invalid OpenAI response" }, { status: 502 });
  }

  const transcript = typeof data.text === "string" ? data.text.trim() : "";
  return NextResponse.json({ transcript });
}
