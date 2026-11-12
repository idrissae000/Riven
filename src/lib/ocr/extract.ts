import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ScannedRiven } from "./map";
import { extractJson, normalizeBox, normalizeScan, type Box } from "./normalize";

/** Vision model. Override with RIVEN_OCR_MODEL (e.g. claude-opus-5-5 for max accuracy). */
export const OCR_MODEL = process.env.RIVEN_OCR_MODEL || "claude-sonnet-5-5";

export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];
/** The browser shrinks images first (see image-prep.ts); this stays under the ~4.5 MB hosting request cap. */
export const MAX_BYTES = 4 * 1024 * 1024;

// Plain types only (no nullable unions): the widest-compatible shape for structured outputs.
// Unknown values use "" for text and -1 for numbers; normalizeScan() turns those into null.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["weapon_name", "riven_name", "polarity", "mastery_rank", "drain", "rerolls", "stats", "notes"],
  properties: {
    weapon_name: { type: "string", description: "ONLY the weapon the riven is for, e.g. 'Soma'. The title line prints the weapon first, then the riven's generated name. Empty string if unreadable." },
    riven_name: { type: "string", description: "ONLY the generated name after the weapon, e.g. 'Crita-cron' (no weapon name in it). Empty string if unreadable." },
    polarity: { type: "string", enum: ["madurai", "vazarin", "naramon", "unknown"], description: "Polarity symbol: V = madurai, D = vazarin, a dash '-' = naramon." },
    mastery_rank: { type: "integer", description: "The 'MR' number (8-16), or -1 if unreadable." },
    drain: { type: "integer", description: "The number in the TOP-RIGHT corner of the card (between 10 and 18), or -1 if unreadable." },
    rerolls: { type: "integer", description: "Re-roll count shown beside the re-roll icon, or -1 if unreadable." },
    stats: {
      type: "array",
      description: "One entry per stat line, top to bottom. The curse (negative stat) is the last line, normally red.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "shown", "is_curse"],
        properties: {
          name: { type: "string", description: "Stat name as printed, e.g. 'Critical Damage'." },
          value: { type: "number", description: "Number with its sign as printed (-30.5). For 'x1.54' use 1.54." },
          shown: { type: "string", description: "The value text exactly as printed, e.g. '+112.3%' or 'x1.54'." },
          is_curse: { type: "boolean", description: "True only for the negative/curse stat." },
        },
      },
    },
    notes: { type: "string", description: "Anything unreadable or uncertain (glare, blur, cropped lines). Empty string if the card was clear." },
  },
} as const;

const PROMPT = `Transcribe the Warframe Riven mod card in this image.

The image may be a clean screenshot OR a photo taken with a phone: a monitor or TV photographed at an angle, with glare, reflections, moiré lines, blur, a tilted or rotated card, a hand or room around it, or the card being only a small part of the picture. Find the riven card, ignore everything else, and read it carefully — zoom in mentally on small text.

Rules:
- Copy stat names and numbers exactly as printed; never invent a value you can't read. If a number is unreadable, leave that stat out and say so in "notes".
- The title line shows the weapon name followed by the riven's generated name (for example "Soma Crita-cron" means weapon_name "Soma", riven_name "Crita-cron"). Put only the weapon in weapon_name and only the generated name in riven_name.
- "drain" is the number in the top-right corner of the card, between 10 and 18. Read it carefully.
- List every stat line, top to bottom. The curse (negative) stat is the last line and is usually red.
- Use "" for unreadable text and -1 for unreadable numbers; never leave a field out.
- If this is not a Riven card at all, return no stats and explain in "notes".`;

const PLAIN_SUFFIX = `\n\nReply with ONLY a JSON object, no prose, with exactly these keys: weapon_name (string), riven_name (string), polarity ("madurai" | "vazarin" | "naramon" | "unknown"), mastery_rank (integer or -1), drain (integer 10-18 or -1), rerolls (integer or -1), stats (array of {name, value (number), shown (string), is_curse (boolean)}), notes (string).`;

export class ScanRefused extends Error {}
/** An error with a message that is safe and useful to show to the user. */
export class ScanFailed extends Error {}

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: AllowedType; data: string } };

const BOX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "x", "y", "w", "h"],
  properties: {
    found: { type: "boolean", description: "True if a Warframe Riven mod card is visible." },
    x: { type: "number", description: "Left edge of the card as a fraction of image width (0-1)." },
    y: { type: "number", description: "Top edge as a fraction of image height (0-1)." },
    w: { type: "number", description: "Card width as a fraction of image width." },
    h: { type: "number", description: "Card height as a fraction of image height." },
  },
} as const;

const LOCATE_PROMPT = `Find the Warframe Riven mod card in this image (a screenshot of the game, or a photo of a screen).
Return its bounding box as fractions of the image: x,y = top-left corner, w,h = size, all between 0 and 1.
Include the whole card: title, polarity icon, every stat line, and the rank and re-roll indicators. Be generous rather than tight — slightly too big is better than cutting off a stat line.
If there is no Riven card, return found=false and zeros.`;

const BOX_PLAIN = `\n\nReply with ONLY a JSON object: {"found": boolean, "x": number, "y": number, "w": number, "h": number}.`;

/**
 * Ask the model for JSON. First with structured outputs (+ server-side refusal fallback); if that request is
 * rejected or comes back empty/truncated, retry as plain "reply with JSON" text. Throws ScanRefused on refusals.
 */
export async function askJson(client: Anthropic, image: ImageBlock, prompt: string, schema: object, plainSuffix: string, maxTokens = 8000): Promise<unknown> {
  const run = async (structuredMode: boolean): Promise<{ text: string; stop: string | null }> => {
    const content = [image, { type: "text" as const, text: structuredMode ? prompt : prompt + plainSuffix }];
    const res = structuredMode
      ? await client.beta.messages.create({
          model: OCR_MODEL,
          max_tokens: maxTokens, // headroom: the model may spend some of this thinking before it writes the JSON
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
          messages: [{ role: "user", content }],
        })
      : await client.messages.create({ model: OCR_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content }] });
    if (res.stop_reason === "refusal") throw new ScanRefused("The model declined to read this image.");
    const block = res.content.find((b) => b.type === "text");
    return { text: block && block.type === "text" ? block.text : "", stop: res.stop_reason };
  };

  let out: { text: string; stop: string | null } | null = null;
  try {
    out = await run(true);
    if (out.stop === "max_tokens" || !out.text.trim()) out = null;
  } catch (e) {
    if (!shouldFallBack(e)) throw e;
    console.error("[scan] structured output failed, retrying as plain JSON:", e instanceof Error ? e.message : e);
  }
  if (!out) out = await run(false);
  try {
    return extractJson(out.text);
  } catch (e) {
    console.error("[scan] could not parse model reply:", e instanceof Error ? e.message : e, out.text.slice(0, 300));
    throw new ScanFailed("Couldn’t read a riven from that image. Try a closer, brighter, straight-on shot of just the card.");
  }
}

/** Worth retrying on the plain-JSON path (request shape / schema problems), as opposed to auth, rate limits, or refusals. */
const shouldFallBack = (e: unknown) =>
  !(e instanceof ScanRefused) && !(e instanceof Anthropic.AuthenticationError) && !(e instanceof Anthropic.PermissionDeniedError) && !(e instanceof Anthropic.RateLimitError);

export const makeClient = () => new Anthropic({ maxRetries: 2, timeout: 55_000 }); // ANTHROPIC_API_KEY (or an `ant auth login` profile)
export const toBlock = (bytes: Buffer, mediaType: AllowedType): ImageBlock => ({ type: "image", source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") } });

/** Stage 1 (big images): where is the riven card? Returns a normalised box, or null to mean "read the whole image". */
export async function locateRivenCard(bytes: Buffer, mediaType: AllowedType): Promise<Box | null> {
  const raw = await askJson(makeClient(), toBlock(bytes, mediaType), LOCATE_PROMPT, BOX_SCHEMA, BOX_PLAIN, 2000);
  return normalizeBox(raw);
}

/** Stage 2: read the (already cropped) riven card. */
export async function scanRivenImage(bytes: Buffer, mediaType: AllowedType): Promise<ScannedRiven> {
  const raw = await askJson(makeClient(), toBlock(bytes, mediaType), PROMPT, SCHEMA, PLAIN_SUFFIX);
  return normalizeScan(raw);
}
