import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireCapability } from "@/lib/access";

// Paid deep-dive report via Claude Vision. This route is only called AFTER
// payment and with the user's explicit consent to transmit their photos
// once (see components/dashboard/FullReport.tsx).
//
// GATED SERVER-SIDE. This carried a "verify payment before launch" note and
// nothing else: the route spends real money at Anthropic and was open to
// anyone who could POST to it, because the only thing in front of it was the
// client deciding whether to show the button.
//
// The check is requireCapability("blueprint") — a signed session for the
// address, plus the entitlement whenever an entitlement could exist. See
// lib/access.ts for why that second half is conditional rather than absolute.

export const maxDuration = 60;

const SYSTEM = `You are a facial-aesthetics coach writing a personalized report.
You receive two photos (front and side profile), on-device geometric
measurements (0-100 heuristic scores plus canthal tilt in degrees), and the
user's quiz answers.

Rules:
- Be honest and specific, but constructive and respectful. Never demean.
- No medical or dermatological diagnoses. For skin/hair concerns that look
  clinical, recommend seeing a professional.
- Ground every observation in what is actually visible or measured.
- Do not invent numeric ratings beyond the provided metrics.

Structure the report in Markdown with these sections:
1. Overview — two or three sentences summarizing the overall picture.
2. Your measurements, explained — what each score means for this face.
3. Strengths — what already works well (be specific).
4. Three focus areas — the biggest realistic levers, with reasoning.
5. 4-week action plan — concrete weekly steps covering skincare (AM/PM),
   jawline & posture, grooming/hairstyle suggestions, and lifestyle.
6. Closing note — brief, encouraging, no fluff.`;

interface ReportBody {
  front: string;
  side: string | null;
  quiz: Record<string, string>;
  metrics: Record<string, unknown>;
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    media_type: match[1] as "image/png" | "image/jpeg" | "image/webp",
    data: match[2],
  };
}

export async function POST(req: Request) {
  // Before the key check, so an unauthorised caller cannot use the error to
  // learn whether the feature is configured.
  const access = await requireCapability("blueprint");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.enforced) {
    console.warn("[report] entitlement not enforced; purchases cannot be granted");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Report generation is not configured yet — set ANTHROPIC_API_KEY in .env.local.",
      },
      { status: 501 },
    );
  }

  let body: ReportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const front = body.front ? parseDataUrl(body.front) : null;
  if (!front) {
    return NextResponse.json(
      { error: "A front-profile photo (PNG/JPEG/WebP data URL) is required." },
      { status: 400 },
    );
  }
  const side = body.side ? parseDataUrl(body.side) : null;

  const content: Anthropic.ContentBlockParam[] = [
    { type: "image", source: { type: "base64", ...front } },
  ];
  if (side) {
    content.push({ type: "image", source: { type: "base64", ...side } });
  }
  content.push({
    type: "text",
    text: `Quiz answers:\n${JSON.stringify(body.quiz, null, 2)}\n\nOn-device scan metrics:\n${JSON.stringify(body.metrics, null, 2)}\n\nWrite the personalized report now. The first image is the front profile${side ? ", the second is the side profile" : " (no side profile provided)"}.`,
  });

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    // Claude Opus 5 safety classifiers can decline a request — check
    // stop_reason before reading content.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error:
            "The report could not be generated for this request. Please try again with different photos.",
        },
        { status: 502 },
      );
    }

    const report = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Report generation failed:", err);
    return NextResponse.json(
      { error: "Report generation failed — please try again in a moment." },
      { status: 502 },
    );
  }
}
