import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await request.json()) as {
      image?: string;
      media_type?: string;
    };
    const { image } = body;
    if (!image)
      return NextResponse.json({ error: "No image" }, { status: 400 });

    const mediaType =
      typeof body.media_type === "string" &&
      body.media_type.startsWith("image/")
        ? body.media_type
        : "image/jpeg";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${image}`,
                },
              },
              {
                type: "text",
                text:
                  [
                    "Identify the food on the photo. Return ONLY JSON (no markdown, no prose):",
                    '{"name":"short Polish product/dish name","kcal_per_100g":n,"protein_per_100g":n,"carbs_per_100g":n,"fat_per_100g":n}',
                    "All numeric values MUST be nutritional estimates PER 100 g of edible product (kcal and grams B/W/T per 100 g).",
                    "If unsure, give a cautious typical value for this food category in Poland.",
                  ].join(" "),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[parse-food-image] OpenAI:", response.status, errText);
      return NextResponse.json(
        { error: "Model request failed" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json?|```/g, "").trim();
    const parsed = JSON.parse(clean) as unknown;
    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
