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
                  'Identify this food. Return ONLY JSON (no markdown): {"name":"Polish name","kcal":n,"protein":n,"carbs":n,"fat":n}. Estimate realistic portion size.',
              },
            ],
          },
        ],
      }),
    });

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
