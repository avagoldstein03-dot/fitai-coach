// PLU (Price Look-Up) codes for loose produce — 4 digits conventional,
// 5 digits with a leading "9" for the organic variant of the same item
// (e.g. 4011 Banana -> 94011 Banana, Organic). This is a small starter
// set of codes we're highly confident about, not the full IFPS registry
// (~1,400 codes) — expand from the official list at ifpsglobal.com
// before relying on this for anything beyond common produce.
interface ProduceItem {
  name: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
}

const BASE_PRODUCE: Record<string, ProduceItem> = {
  "4011": { name: "Banana", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  "4012": { name: "Orange, Navel", caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1 },
  "4013": { name: "Lemon", caloriesPer100g: 29, proteinPer100g: 1.1, carbsPer100g: 9, fatPer100g: 0.3 },
  "4016": { name: "Apple, Red Delicious", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  "4017": { name: "Apple, Golden Delicious", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  "4046": { name: "Avocado, Hass", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 9, fatPer100g: 15 },
  "4053": { name: "Watermelon, Seedless", caloriesPer100g: 30, proteinPer100g: 0.6, carbsPer100g: 8, fatPer100g: 0.2 },
  "4225": { name: "Sweet Potato", caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20, fatPer100g: 0.1 },
};

export interface PLULookupResult {
  name: string;
  isOrganic: boolean;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
}

// Returns null both for "not a PLU-shaped code" and "not in our table" —
// callers only need to know whether to treat it as a resolved item.
export function lookupPLU(code: string): PLULookupResult | null {
  const trimmed = code.trim();
  if (!/^\d{4,5}$/.test(trimmed)) return null;

  const isOrganic = trimmed.length === 5 && trimmed.startsWith("9");
  const baseCode = isOrganic ? trimmed.slice(1) : trimmed;
  const item = BASE_PRODUCE[baseCode];
  if (!item) return null;

  return {
    name: isOrganic ? `${item.name} (Organic)` : item.name,
    isOrganic,
    caloriesPer100g: item.caloriesPer100g ?? null,
    proteinPer100g: item.proteinPer100g ?? null,
    carbsPer100g: item.carbsPer100g ?? null,
    fatPer100g: item.fatPer100g ?? null,
  };
}
