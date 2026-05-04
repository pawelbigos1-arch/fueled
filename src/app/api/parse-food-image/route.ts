import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: image,
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
      console.error("[parse-food-image] Anthropic:", response.status, errText);
      return NextResponse.json(
        { error: "Model request failed" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>;
    };
    const raw = data.content?.[0]?.text || "{}";
    const clean = raw.replace(/```json?|```/g, "").trim();
    const parsed = JSON.parse(clean) as unknown;
    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
