import axios from "axios";

const OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "product_name,brands,image_url,ingredients_text,additives_tags,nova_group,nutriscore_grade,nutriments,serving_quantity";
const VALID_NUTRISCORE_GRADES = new Set(["a", "b", "c", "d", "e"]);

export interface OFFProduct {
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  additivesTags: string[];
  novaGroup: number | null;
  nutriscoreGrade: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  servingSizeGrams: number | null;
}

// Returns null when Open Food Facts genuinely has no data for this barcode
// (status: 0 in the body — OFF returns this as either a 200 or a 404
// depending on the barcode, so we treat both as a normal response rather
// than an HTTP error). Throws only on a real network/5xx failure, so the
// caller can distinguish "not found" from "upstream down".
export async function lookupProduct(barcode: string): Promise<OFFProduct | null> {
  try {
    const response = await axios.get(`${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json`, {
      params: { fields: FIELDS },
      timeout: 8000,
      headers: { "User-Agent": "ActiveAI/1.0 (support@activeai.app)" },
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.data?.status !== 1 || !response.data?.product) {
      return null;
    }

    const p = response.data.product;
    const nutriments = p.nutriments ?? {};
    return {
      productName: p.product_name || null,
      brand: p.brands || null,
      imageUrl: p.image_url || null,
      ingredientsText: p.ingredients_text || null,
      additivesTags: Array.isArray(p.additives_tags) ? p.additives_tags : [],
      novaGroup: typeof p.nova_group === "number" ? p.nova_group : null,
      // OFF sometimes returns "not-applicable", "unknown", or other non-letter
      // values here instead of a real grade — anything outside a-e must become
      // null, or it flows through as a raw, untranslatable string in the UI.
      nutriscoreGrade:
        typeof p.nutriscore_grade === "string" && VALID_NUTRISCORE_GRADES.has(p.nutriscore_grade.toLowerCase())
          ? p.nutriscore_grade.toLowerCase()
          : null,
      caloriesPer100g: typeof nutriments["energy-kcal_100g"] === "number" ? nutriments["energy-kcal_100g"] : null,
      proteinPer100g: typeof nutriments.proteins_100g === "number" ? nutriments.proteins_100g : null,
      carbsPer100g: typeof nutriments.carbohydrates_100g === "number" ? nutriments.carbohydrates_100g : null,
      fatPer100g: typeof nutriments.fat_100g === "number" ? nutriments.fat_100g : null,
      servingSizeGrams: typeof p.serving_quantity === "number" ? p.serving_quantity : null,
    };
  } catch (error) {
    console.error("Open Food Facts lookup failed:", error);
    throw error;
  }
}
