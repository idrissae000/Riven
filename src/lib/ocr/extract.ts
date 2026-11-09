import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ScannedRiven } from "./map";

/** Vision model. Override with RIVEN_OCR_MODEL (e.g. a cheaper Sonnet/Haiku) once you've compared accuracy. */
export const OCR_MODEL = process.env.RIVEN_OCR_MODEL || "claude-opus-5-5";

export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];
export const MAX_BYTES = 5 * 1024 * 1024;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["weapon_name", "riven_name", "polarity", "mastery_rank", "rank", "rerolls", "stats", "notes"],
  properties: {
    weapon_name: { type: ["string", "null"], description: "Weapon the riven is for, e.g. 'Soma' (the title line, without the word 'Riven')." },
    riven_name: { type: ["string", "null"], description: "The riven's generated name, e.g. 'Crita-cron'." },
    polarity: { type: ["string", "null"], enum: ["madurai", "vazarin", "naramon", null], description: "Polarity symbol: V = madurai, D = vazarin, a dash '-' = naramon." },
    mastery_rank: { type: ["integer", "null"], description: "The 'MR' number." },
    rank: { type: ["integer", "null"], description: "Mod rank 0-8, from the filled rank pips." },
    rerolls: { type: ["integer", "null"], description: "Re-roll / cycle count shown next to the re-roll icon." },
    stats: {
      type: "array",
      description: "One entry per stat line, top to bottom. The negative stat (curse) is the last line, normally in red.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "shown", "is_curse"],
        properties: {
          name: { type: "string", description: "Stat name exactly as printed, e.g. 'Critical Damage'." },
          value: { type: "number", description: "Numeric value with its sign as printed (e.g. -30.5). For 'x1.54' use 1.54." },
          shown: { type: "string", description: "The value text exactly as printed, e.g. '+112.3%' or 'x1.54'." },
          is_curse: { type: "boolean", description: "True only for the negative/curse stat." },
        },
      },
    },
    notes: { type: ["string", "null"], description: "Anything unreadable or uncertain (blur, cropped lines). Null if the card was clear." },
  },
} as const;

const PROMPT = `This is a screenshot of a Warframe Riven mod card. Transcribe it faithfully.
- Copy stat names and numbers exactly as printed; never guess a value you cannot read. Put doubts in "notes" and use null for unreadable header fields.
- Include every stat line, top to bottom. The curse (negative) stat is the final line and is usually red.
- If the image is not a Riven card, return empty stats and explain in "notes".`;

export class ScanRefused extends Error {}

export async function scanRivenScreenshot(bytes: Buffer, mediaType: AllowedType): Promise<ScannedRiven> {
  const client = new Anthropic(); // ANTHROPIC_API_KEY (or an `ant auth login` profile)
  const res = await client.beta.messages.create({
    model: OCR_MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // a safety-classifier decline is retried on a fallback model server-side
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") } },
        { type: "text", text: PROMPT },
      ],
    }],
  });

  if (res.stop_reason === "refusal") throw new ScanRefused("The model declined to read this image.");
  if (res.stop_reason === "max_tokens") throw new Error("The scan was cut off — try a tighter crop of the card.");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The model returned no text.");
  const parsed = JSON.parse(text.text) as ScannedRiven;
  if (!Array.isArray(parsed.stats)) throw new Error("Unexpected scan format.");
  return parsed;
}
