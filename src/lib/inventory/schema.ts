import { z } from "zod";

/** One inventory entry to add: `qty` copies of an item (arcanes at rank 0 = unranked, or at their max rank). */
export const inventoryInputSchema = z.object({
  kind: z.enum(["prime", "arcane"]),
  slug: z.string().trim().min(1).max(120),
  rank: z.number().int().min(0).max(10).default(0),
  qty: z.number().int().min(1, "Quantity must be at least 1").max(9999),
});
export type InventoryInput = z.infer<typeof inventoryInputSchema>;

export const inventoryQtySchema = z.object({ qty: z.number().int().min(1).max(9999) });
