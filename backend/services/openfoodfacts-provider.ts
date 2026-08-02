import axios from "axios";

const OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "product_name,brands,image_url,ingredients_text,additives_tags,nova_group,nutriscore_grade";

export interface OFFProduct {
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  ingredientsText: string | null;
  additivesTags: string[];
  novaGroup: number | null;
  nutriscoreGrade: string | null;
}

// Returns null when Open Food Facts genuinely has no data for this barcode
// (status: 0, a 200 response — not an HTTP error). Throws on network/HTTP
// failure so the caller can distinguish "not found" from "upstream down".
export async function lookupProduct(barcode: string): Promise<OFFProduct | null> {
  try {
    const response = await axios.get(`${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json`, {
      params: { fields: FIELDS },
      timeout: 8000,
      headers: { "User-Agent": "ActiveAICoach/1.0 (support@activeaicoach.app)" },
    });

    if (response.data?.status !== 1 || !response.data?.product) {
      return null;
    }

    const p = response.data.product;
    return {
      productName: p.product_name || null,
      brand: p.brands || null,
      imageUrl: p.image_url || null,
      ingredientsText: p.ingredients_text || null,
      additivesTags: Array.isArray(p.additives_tags) ? p.additives_tags : [],
      novaGroup: typeof p.nova_group === "number" ? p.nova_group : null,
      nutriscoreGrade: p.nutriscore_grade || null,
    };
  } catch (error) {
    console.error("Open Food Facts lookup failed:", error);
    throw error;
  }
}
