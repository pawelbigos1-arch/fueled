import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type ParseFoodResult = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SYSTEM_PROMPT =
  [
    'Wyceniaj posiłek po opisie (PL/EN). Odpowiedź TYLKO JSON (bez markdown, bez tekstu poza JSON):',
    '{"name":"krótka nazwa po polsku","kcal":n,"protein":n,"carbs":n,"fat":n}',
    "",
    "Zasady:",
    "- Jedna porcja dla jednej dorosłej osoby, typowe POLSKIE domowe porcjowanie — NIE jak duży talerz w restauracji ani podwójna dawka.",
    '- Brak gramów lub ogólne określenia („trochę”, „kawałek”, „plasterek” bez wagi)? Przyjmij MNIEJSZĄ tipową wartość: cienkie plastry szynki, skromnie sera, smażenie = umiarkowany tłuszcz, nie „zalane” oliwą.',
    "- Jedna tortilla/wrap bez „mega” lub „podwójna”? Jedna STANDARDOWA tortilla pszenna (ok. 140–220 kcal zależnie od rozmiaru, nie XXL).",
    "- Kiełbasiany deli / szynka: bez podanej ilości max ~50–70 g jeśli użytkownik nie pisze że DUŻO.",
    "- Jeśli musisz zgadywać ilość, nieco NIEDOSZACUJ zamiast przeszacowywać (bezpieczniej przy liczeniu diety).",
    "- Makra i kcal muszą się mniej więcej zgadać: oczekiwana energia ok. 4*białko + 4*węgle + 9*tłuszcz kcal.",
    "- Wiele pozycji: zsumuj wszystkie składniki.",
  ].join("\n");

function parseNutritionJson(raw: string): ParseFoodResult | null {
  try {
    const trimmed = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    if (
      typeof parsed.name !== "string" ||
      typeof parsed.kcal !== "number" ||
      typeof parsed.protein !== "number" ||
      typeof parsed.carbs !== "number" ||
      typeof parsed.fat !== "number"
    ) {
      return null;
    }

    if (
      !Number.isFinite(parsed.kcal) ||
      !Number.isFinite(parsed.protein) ||
      !Number.isFinite(parsed.carbs) ||
      !Number.isFinite(parsed.fat)
    ) {
      return null;
    }

    const name = parsed.name.trim();
    if (!name) return null;

    const protein = Math.max(0, Math.round(parsed.protein));
    const carbs = Math.max(0, Math.round(parsed.carbs));
    const fat = Math.max(0, Math.round(parsed.fat));
    let kcal = Math.max(0, Math.round(parsed.kcal));

    /** Gdy kalorie zdecydowanie odskakują w górę od makr, przyciń do fizyki makro (częsty błąd modeli). */
    const fromMacros = Math.round(4 * protein + 4 * carbs + 9 * fat);
    if (fromMacros > 0 && kcal > fromMacros * 1.22) {
      kcal = fromMacros;
    }

    return { name, kcal, protein, carbs, fat };
  } catch {
    return null;
  }
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

  const text =
    typeof body === "object" &&
    body !== null &&
    "text" in body &&
    typeof (body as { text: unknown }).text === "string"
      ? (body as { text: string }).text.trim()
      : "";

  if (!text) {
    return NextResponse.json({ error: "Missing or empty text" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    }),
  });

  const rawBody = await response.text();
  console.log("[parse-food] OpenAI status:", response.status, "body:", rawBody);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "OpenAI request failed",
        status: response.status,
        openai_body: rawBody.slice(0, 2000),
      },
      { status: 502 }
    );
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON from OpenAI" }, { status: 502 });
  }

  const assistantText = data.choices?.[0]?.message?.content?.trim() ?? "";

  const parsed = parseNutritionJson(assistantText);

  if (!parsed) {
    return NextResponse.json({ error: "Failed to parse nutrition response" }, { status: 400 });
  }

  return NextResponse.json(parsed);
}
