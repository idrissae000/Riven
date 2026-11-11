import data from "../../../data/primes.json";
import type { PrimeCatalogue } from "./types";

/** The Prime part / relic catalogue (data/primes.json, rebuilt by `npm run sync:primes`). */
export const primeCatalogue = data as unknown as PrimeCatalogue;
