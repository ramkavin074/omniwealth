// Presets for the first-run setup shown right after owner sign-up. Region
// keys match RetirementCalculator's country keys (households.retirementCountry).

export interface Region {
  key: string;
  label: string;
  currency: string;
  /** Typical household income in `currency`; anchors the retirement-income and goal-target presets. */
  income: number;
}

export const REGIONS: Region[] = [
  { key: 'US', label: 'United States', currency: 'USD', income: 60000 },
  { key: 'UK', label: 'United Kingdom', currency: 'GBP', income: 45000 },
  { key: 'EU', label: 'Eurozone', currency: 'EUR', income: 50000 },
  { key: 'India', label: 'India', currency: 'INR', income: 1200000 },
  { key: 'Canada', label: 'Canada', currency: 'CAD', income: 75000 },
  { key: 'Australia', label: 'Australia', currency: 'AUD', income: 80000 },
  { key: 'Switzerland', label: 'Switzerland', currency: 'CHF', income: 90000 },
  { key: 'Japan', label: 'Japan', currency: 'JPY', income: 6000000 },
  { key: 'China', label: 'China', currency: 'CNY', income: 350000 },
];

export const CURRENCIES = REGIONS.map((r) => r.currency);

export function regionByKey(key: string): Region {
  return REGIONS.find((r) => r.key === key) ?? REGIONS[0];
}

/** Round to 2 significant figures so presets read as clean numbers. */
export function niceAmount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export interface GoalPreset {
  name: string;
  description: string;
  /** Multiple of the region's typical income. */
  multiple: number;
}

export const GOAL_PRESETS: GoalPreset[] = [
  { name: 'Emergency fund', description: 'About six months of expenses', multiple: 0.5 },
  { name: 'Home down payment', description: 'Saving toward a home', multiple: 1 },
  { name: "Children's education", description: 'School and college', multiple: 1.5 },
  { name: 'Travel & experiences', description: 'Trips and big plans', multiple: 0.25 },
];

export function goalTargetFor(preset: GoalPreset, region: Region): number {
  return niceAmount(region.income * preset.multiple);
}
