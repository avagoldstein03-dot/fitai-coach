export type UnitSystem = "imperial" | "metric";

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches % 12);
  return { ft, in: inch };
}

export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54;
}

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function inchesToCm(inches: number): number {
  return inches * 2.54;
}

// `weightKg` is always the value stored in the database (cm/kg are canonical storage units)
export function formatWeight(weightKg: number | null | undefined, unitSystem?: UnitSystem | null): string {
  if (weightKg == null) return "--";
  if (unitSystem === "metric") {
    return `${Math.round(weightKg * 10) / 10} kg`;
  }
  return `${Math.round(kgToLbs(weightKg))} lbs`;
}

export function formatHeight(heightCm: number | null | undefined, unitSystem?: UnitSystem | null): string {
  if (heightCm == null) return "--";
  if (unitSystem === "metric") {
    return `${Math.round(heightCm)} cm`;
  }
  const { ft, in: inch } = cmToFtIn(heightCm);
  return `${ft}'${inch}"`;
}
