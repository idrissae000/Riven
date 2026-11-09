import { z } from "zod";
import { POLARITIES } from "@/lib/types";

// NOTE: whether a value's sign is right depends on the attribute (Recoil is inverted),
// so that is checked server-side against riven_attributes (see stat-sign.ts).
export const rivenStatSchema = z.object({
  stat: z.string().min(1, "Pick a stat"),
  value: z.number().finite(),
  is_negative: z.boolean(),
});

export const rivenInputSchema = z
  .object({
    weapon_slug: z.string().min(1, "Pick a weapon"),
    riven_name: z.string().trim().max(40).nullish(),
    polarity: z.enum(POLARITIES as [string, ...string[]]),
    mastery_rank: z.number().int().min(8).max(16),
    rank: z.number().int().min(0).max(8),
    rerolls: z.number().int().min(0).max(999),
    stats: z.array(rivenStatSchema).min(2, "A riven has at least 2 stats").max(4),
    has_negative: z.boolean(),
    notes: z.string().trim().max(500).nullish(),
  })
  .superRefine((r, ctx) => {
    const negatives = r.stats.filter((s) => s.is_negative);
    const positives = r.stats.length - negatives.length;
    if (negatives.length > 1) ctx.addIssue({ code: "custom", message: "Only one negative stat allowed", path: ["stats"] });
    if (positives > 3) ctx.addIssue({ code: "custom", message: "At most 3 positive stats", path: ["stats"] });
    if (r.has_negative !== (negatives.length === 1))
      ctx.addIssue({ code: "custom", message: "has_negative must match the stats", path: ["has_negative"] });
    const seen = new Set<string>();
    for (const s of r.stats) {
      if (seen.has(s.stat)) ctx.addIssue({ code: "custom", message: "Duplicate stat", path: ["stats"] });
      seen.add(s.stat);
    }
  });

export type RivenInput = z.infer<typeof rivenInputSchema>;
