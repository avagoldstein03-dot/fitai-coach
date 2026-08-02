export type RiskLevel = "moderate" | "high";

export interface ConcerningAdditive {
  code: string;
  name: string;
  riskLevel: RiskLevel;
  reason: string;
}

// Curated from general knowledge of additives commonly flagged by
// Yuka/EWG-style rating apps — skim and adjust before shipping.
export const CONCERNING_ADDITIVES: ConcerningAdditive[] = [
  { code: "e171", name: "Titanium Dioxide", riskLevel: "high", reason: "Banned as a food additive in the EU (2022) over genotoxicity concerns" },
  { code: "e320", name: "BHA (Butylated Hydroxyanisole)", riskLevel: "high", reason: "Possible carcinogen and endocrine disruptor" },
  { code: "e321", name: "BHT (Butylated Hydroxytoluene)", riskLevel: "high", reason: "Possible carcinogen and endocrine disruptor" },
  { code: "e924", name: "Potassium Bromate", riskLevel: "high", reason: "Banned in many countries; classified as a possible carcinogen" },
  { code: "e249", name: "Potassium Nitrite", riskLevel: "high", reason: "Forms nitrosamines, linked to increased cancer risk" },
  { code: "e250", name: "Sodium Nitrite", riskLevel: "high", reason: "Forms nitrosamines, linked to increased cancer risk" },
  { code: "e251", name: "Sodium Nitrate", riskLevel: "high", reason: "Precursor to nitrite; same cancer-risk concern" },
  { code: "e252", name: "Potassium Nitrate", riskLevel: "high", reason: "Precursor to nitrite; same cancer-risk concern" },
  { code: "e951", name: "Aspartame", riskLevel: "high", reason: "Classified by IARC as possibly carcinogenic to humans" },
  { code: "e954", name: "Saccharin", riskLevel: "high", reason: "Historically linked to bladder tumors in animal studies" },
  { code: "e127", name: "Erythrosine", riskLevel: "high", reason: "Linked to thyroid tumors in animal studies" },
  { code: "e128", name: "Red 2G", riskLevel: "high", reason: "Banned in the EU; carcinogenic metabolite concerns" },
  { code: "e102", name: "Tartrazine", riskLevel: "high", reason: "Artificial color linked to hyperactivity in children" },
  { code: "e110", name: "Sunset Yellow FCF", riskLevel: "high", reason: "Artificial color linked to hyperactivity in children" },
  { code: "e122", name: "Carmoisine", riskLevel: "high", reason: "Artificial color linked to hyperactivity in children" },
  { code: "e124", name: "Ponceau 4R", riskLevel: "high", reason: "Artificial color linked to hyperactivity in children" },
  { code: "e129", name: "Allura Red AC", riskLevel: "high", reason: "Artificial color linked to hyperactivity in children" },
  { code: "e310", name: "Propyl Gallate", riskLevel: "high", reason: "Possible endocrine disruptor" },
  { code: "e150d", name: "Caramel Colour (sulphite ammonia)", riskLevel: "high", reason: "Contains 4-MEI, a possible carcinogen" },
  { code: "e211", name: "Sodium Benzoate", riskLevel: "moderate", reason: "Can form benzene with vitamin C; linked to hyperactivity" },
  { code: "e212", name: "Potassium Benzoate", riskLevel: "moderate", reason: "Same concerns as sodium benzoate" },
  { code: "e282", name: "Calcium Propionate", riskLevel: "moderate", reason: "Linked to behavioral effects in children in some studies" },
  { code: "e407", name: "Carrageenan", riskLevel: "moderate", reason: "Linked to digestive inflammation in some studies" },
  { code: "e433", name: "Polysorbate 80", riskLevel: "moderate", reason: "Linked to gut inflammation in animal studies" },
  { code: "e466", name: "Carboxymethyl Cellulose", riskLevel: "moderate", reason: "Linked to gut microbiome disruption in animal studies" },
  { code: "e621", name: "Monosodium Glutamate (MSG)", riskLevel: "moderate", reason: "Some individuals report sensitivity or headaches" },
  { code: "e950", name: "Acesulfame Potassium", riskLevel: "moderate", reason: "Artificial sweetener with limited long-term safety data" },
  { code: "e952", name: "Cyclamate", riskLevel: "moderate", reason: "Banned in the US over cancer concerns; restricted elsewhere" },
  { code: "e955", name: "Sucralose", riskLevel: "moderate", reason: "Some studies link it to gut microbiome changes" },
  { code: "e339", name: "Sodium Phosphate", riskLevel: "moderate", reason: "Excess phosphate additives linked to cardiovascular risk" },
  { code: "e450", name: "Diphosphates", riskLevel: "moderate", reason: "Excess phosphate additives linked to cardiovascular risk" },
  { code: "e451", name: "Triphosphates", riskLevel: "moderate", reason: "Excess phosphate additives linked to cardiovascular risk" },
  { code: "e133", name: "Brilliant Blue FCF", riskLevel: "moderate", reason: "Artificial color with some evidence of hyperactivity link" },
  { code: "e142", name: "Green S", riskLevel: "moderate", reason: "Artificial color with allergic reaction reports" },
  { code: "e220", name: "Sulphur Dioxide", riskLevel: "moderate", reason: "Can trigger asthma or allergic reactions in sensitive people" },
  { code: "e223", name: "Sodium Metabisulphite", riskLevel: "moderate", reason: "Sulphite; can trigger asthma in sensitive people" },
  { code: "e228", name: "Potassium Bisulphite", riskLevel: "moderate", reason: "Sulphite; can trigger asthma in sensitive people" },
  { code: "e160b", name: "Annatto", riskLevel: "moderate", reason: "Allergic reaction reports in sensitive individuals" },
  { code: "e1520", name: "Propylene Glycol", riskLevel: "moderate", reason: "Can cause irritation at high doses" },
];

// Bump whenever CONCERNING_ADDITIVES or the scoring formula changes, so
// cached ProductScan rows know to recompute from their stored raw fields.
export const SCORING_VERSION = 1;

export type ProductGrade = "great" | "good" | "mediocre" | "bad";

export interface FlaggedIngredient {
  code: string;
  name: string;
  riskLevel: RiskLevel;
  reason: string;
}

export interface ProductScoreInput {
  novaGroup?: number | null;
  nutriscoreGrade?: string | null;
  additivesTags?: string[];
}

export interface ProductScoreResult {
  score: number;
  grade: ProductGrade;
  flaggedIngredients: FlaggedIngredient[];
}

function normalizeCode(tag: string): string {
  return tag.replace(/^en:/i, "").toLowerCase().trim();
}

const NUTRISCORE_BASE: Record<string, number> = { a: 90, b: 75, c: 60, d: 40, e: 20 };
const NOVA_PENALTY: Record<number, number> = { 1: 0, 2: 5, 3: 10, 4: 20 };
const MODERATE_PENALTY_PER_ITEM = 5;
const MODERATE_PENALTY_CAP = 20;
const HIGH_PENALTY_PER_ITEM = 12;
const HIGH_PENALTY_CAP = 40;

export function computeProductScore(input: ProductScoreInput): ProductScoreResult {
  const base = input.nutriscoreGrade
    ? NUTRISCORE_BASE[input.nutriscoreGrade.toLowerCase()] ?? 60
    : 60;
  const novaPenalty = input.novaGroup != null ? NOVA_PENALTY[input.novaGroup] ?? 0 : 0;

  const codes = new Set((input.additivesTags ?? []).map(normalizeCode));
  const flaggedIngredients: FlaggedIngredient[] = CONCERNING_ADDITIVES.filter((a) => codes.has(a.code));

  const moderateCount = flaggedIngredients.filter((f) => f.riskLevel === "moderate").length;
  const highCount = flaggedIngredients.filter((f) => f.riskLevel === "high").length;
  const moderatePenalty = Math.min(moderateCount * MODERATE_PENALTY_PER_ITEM, MODERATE_PENALTY_CAP);
  const highPenalty = Math.min(highCount * HIGH_PENALTY_PER_ITEM, HIGH_PENALTY_CAP);

  const score = Math.max(0, Math.min(100, base - novaPenalty - moderatePenalty - highPenalty));

  let grade: ProductGrade;
  if (score >= 80) grade = "great";
  else if (score >= 50) grade = "good";
  else if (score >= 20) grade = "mediocre";
  else grade = "bad";

  return { score, grade, flaggedIngredients };
}
