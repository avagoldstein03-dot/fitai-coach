import {
  kgToLbs,
  lbsToKg,
  cmToFtIn,
  ftInToCm,
  cmToInches,
  inchesToCm,
  formatWeight,
  formatHeight,
} from "./units";

describe("kgToLbs / lbsToKg", () => {
  it("converts kg to lbs", () => {
    expect(kgToLbs(70)).toBeCloseTo(154.32, 1);
  });

  it("round-trips kg -> lbs -> kg", () => {
    expect(lbsToKg(kgToLbs(70))).toBeCloseTo(70, 5);
  });
});

describe("cmToFtIn / ftInToCm", () => {
  it("converts cm to feet/inches", () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 11 });
  });

  it("round-trips ft/in -> cm -> ft/in", () => {
    expect(cmToFtIn(ftInToCm(6, 0))).toEqual({ ft: 6, in: 0 });
  });
});

describe("cmToInches / inchesToCm", () => {
  it("converts cm to inches and back", () => {
    expect(cmToInches(inchesToCm(10))).toBeCloseTo(10, 5);
  });
});

describe("formatWeight", () => {
  it("returns '--' for null/undefined", () => {
    expect(formatWeight(null, "metric")).toBe("--");
    expect(formatWeight(undefined, "imperial")).toBe("--");
  });

  it("formats in kg for metric", () => {
    expect(formatWeight(70.55, "metric")).toBe("70.6 kg");
  });

  it("formats in lbs for imperial (default)", () => {
    expect(formatWeight(70, "imperial")).toBe(`${Math.round(kgToLbs(70))} lbs`);
  });

  it("defaults to lbs when unitSystem is not provided", () => {
    expect(formatWeight(70)).toBe(`${Math.round(kgToLbs(70))} lbs`);
  });
});

describe("formatHeight", () => {
  it("returns '--' for null/undefined", () => {
    expect(formatHeight(null, "metric")).toBe("--");
    expect(formatHeight(undefined)).toBe("--");
  });

  it("formats in cm for metric", () => {
    expect(formatHeight(180.4, "metric")).toBe("180 cm");
  });

  it("formats in feet/inches for imperial", () => {
    expect(formatHeight(180, "imperial")).toBe(`5'11"`);
  });
});
