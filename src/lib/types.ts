export type Polarity = "madurai" | "vazarin" | "naramon";
export const POLARITIES: Polarity[] = ["madurai", "vazarin", "naramon"];

export interface Weapon {
  slug: string;
  name: string;
  riven_type: string;
  group_name: string | null;
  disposition: number | null;
  req_mastery: number | null;
  icon: string | null;
}

export interface RivenAttribute {
  slug: string;
  name: string;
  unit: string | null;
  exclusive_to: string[] | null;
  positive_only: boolean;
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
}
