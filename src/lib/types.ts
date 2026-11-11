export type Polarity = "madurai" | "vazarin" | "naramon";
export const POLARITIES: Polarity[] = ["madurai", "vazarin", "naramon"];

export interface Weapon {
  slug: string;
  name: string;
  riven_type: string;
  group_name: string | null;
  req_mastery: number | null;
  icon: string | null;
}

export interface RivenAttribute {
  slug: string;
  name: string;
  unit: string | null;
  exclusive_to: string[] | null;
  positive_only: boolean;
  /** Beneficial when NEGATIVE (e.g. Weapon Recoil). */
  inverted: boolean;
  prefix: string | null;
  suffix: string | null;
}

export interface RivenStat {
  stat: string; // riven_attributes.slug
  value: number; // signed
  is_negative: boolean;
}

export interface Riven {
  id: string;
  user_id: string;
  weapon_slug: string;
  riven_name: string | null;
  polarity: Polarity;
  mastery_rank: number;
  rank: number;
  rerolls: number;
  stats: RivenStat[];
  has_negative: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  wfm_auction_id?: string | null;
  wfm_listed_at?: string | null;
  wfm_price?: number | null;
  /** Last market estimate (see migration 0011); est_at is set even when there was no estimate. */
  est_low?: number | null;
  est_median?: number | null;
  est_high?: number | null;
  est_confidence?: string | null;
  est_samples?: number | null;
  est_at?: string | null;
}
