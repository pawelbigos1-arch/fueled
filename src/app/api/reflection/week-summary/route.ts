import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = [
  "Jesteś coachem refleksji. Dostaniesz wpisy z kilku dni (data, transkrypcja, ewentualne podsumowanie dnia).",
  "Napisz po polsku spójne podsumowanie tygodnia: główne tematy, emocje, postępy, wzorce, rekomendacje na kolejny tydzień.",
  "3–5 akapitów, konkretnie, bez wymyślania faktów. Tylko tekst podsumowania — bez markdown i JSON.",
].join("\n");

type Entry = { date: string; transcript: string; summary?: string };

function formatEntries(entries: Entry[]): string {
  return entries
    .map((e) => {
      const parts = [`Data: ${e.date}`];
      if (e.transcript.trim()) parts.push(`Transkrypcja:\n${e.transcript.trim()}`);
      if (e.summary?.trim()) parts.push(`Podsumowanie dnia:\n${e.summary.trim()}`);
      return parts.join("\n\n");
    })
    .join("\n\n---\n\n");
}

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

  const rawEntries =
    typeof body === "object" &&
    body !== null &&
    "entries" in body &&
    Array.isArray((body as { entries: unknown }).entries)
      ? (body as { entries: unknown[] }).entries
      : [];

  const entries: Entry[] = rawEntries
    .map((item) => {
      const row = item as Record<string, unknown>;
      const date = typeof row.date === "string" ? row.date : "";
      const transcript = typeof row.transcript === "string" ? row.transcript : "";
      const summary = typeof row.summary === "string" ? row.summary : "";
      return { date, transcript, summary };
    })
    .filter((e) => e.date && (e.transcript.trim() || e.summary?.trim()))
    .slice(0, 7);

  if (entries.length === 0) {
    return NextResponse.json({ error: "No reflection entries provided" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: formatEntries(entries) },
      ],
    }),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    console.error("[reflection/week-summary] OpenAI:", response.status, rawBody.slice(0, 500));
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
