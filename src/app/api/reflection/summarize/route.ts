import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = [
  "Jesteś empatycznym coachem refleksji dnia. Użytkownik poda transkrypcję swojej wypowiedzi (PL).",
  "Napisz szczegółowe podsumowanie po polsku: co się wydarzyło, emocje, wnioski, priorytety na jutro.",
  "Pisz w 2–4 akapitach, konkretnie, bez moralizowania. Nie wymyślaj faktów spoza transkrypcji.",
  "Odpowiedz TYLKO tekstem podsumowania — bez nagłówków markdown, bez JSON.",
].join("\n");

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript =
    typeof body === "object" &&
    body !== null &&
    "transcript" in body &&
    typeof (body as { transcript: unknown }).transcript === "string"
      ? (body as { transcript: string }).transcript.trim()
      : "";

  if (!transcript) {
    return NextResponse.json({ error: "Missing or empty transcript" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    console.error("[reflection/summarize] OpenAI:", response.status, rawBody.slice(0, 500));
    return NextResponse.json({ error: "OpenAI request failed" }, { status: 502 });
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    return NextResponse.json({ error: "Invalid OpenAI response" }, { status: 502 });
  }

  const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) {
    return NextResponse.json({ error: "Empty summary" }, { status: 502 });
  }

  return NextResponse.json({ summary });
}
