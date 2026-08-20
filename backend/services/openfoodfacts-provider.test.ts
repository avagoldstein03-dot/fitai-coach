import axios from "axios";
import { lookupProduct } from "./openfoodfacts-provider";

jest.mock("axios");

describe("openfoodfacts-provider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns null when Open Food Facts responds 200 with status: 0 (not found)", async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { status: 0 } });

    const result = await lookupProduct("0000000000000");

    expect(result).toBeNull();
  });

  it("returns null when Open Food Facts responds 404 with status: 0 (not found) instead of throwing", async () => {
    // Some barcodes return a real HTTP 404 rather than a 200 — this must
    // NOT be treated as an upstream failure, since it's a legitimate
    // "we don't have this product" response, not an outage.
    (axios.get as jest.Mock).mockResolvedValue({ status: 404, data: { status: 0 } });

    const result = await lookupProduct("269340511090");

    expect(result).toBeNull();
  });

  it("returns the parsed product on a 200 with status: 1", async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        status: 1,
        product: {
          product_name: "Test Cereal",
          brands: "Test Brand",
          nova_group: 4,
          nutriscore_grade: "d",
          nutriments: { "energy-kcal_100g": 400, proteins_100g: 5, carbohydrates_100g: 70, fat_100g: 10 },
        },
      },
    });

    const result = await lookupProduct("0123456789012");

    expect(result).toEqual(
      expect.objectContaining({
        productName: "Test Cereal",
        brand: "Test Brand",
        novaGroup: 4,
        nutriscoreGrade: "d",
        caloriesPer100g: 400,
        proteinPer100g: 5,
        carbsPer100g: 70,
        fatPer100g: 10,
      })
    );
  });

  it("throws on a real network/upstream failure so the caller can distinguish it from not-found", async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error("network error"));

    await expect(lookupProduct("0123456789012")).rejects.toThrow("network error");
  });
});
