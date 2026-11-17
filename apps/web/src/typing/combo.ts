export const COMBO_METER_MAX = 50;

export type ComboTier = "steady" | "flowing" | "inked" | null;

export function comboTier(combo: number): ComboTier {
  if (combo >= 50) return "inked";
  if (combo >= 25) return "flowing";
  if (combo >= 10) return "steady";
  return null;
}

// How full the combo meter is, 0 to 100.
export function comboMeterPercent(combo: number): number {
  return Math.min(100, Math.round((combo / COMBO_METER_MAX) * 100));
}