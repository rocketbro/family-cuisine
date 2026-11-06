// Reading and writing the amounts people put in recipes: "1 1/2", "½", "2-3", "0.25".

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

/** Matches a leading amount, including ranges: "1 1/2", "1½", "2-3", "¾". */
const NUMBER = `(?:\\d+\\s+\\d+/\\d+|\\d+\\s*[${FRACTION_CHARS}]|\\d+/\\d+|[${FRACTION_CHARS}]|\\d+(?:\\.\\d+)?)`;
export const AMOUNT_PATTERN = new RegExp(`^(${NUMBER})(?:\\s*(?:-|–|to)\\s*(${NUMBER}))?(?=\\s|$)`);

export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let total = 0;
  let matched = false;
  for (const part of trimmed.split(/\s+/)) {
    const value = parsePart(part);
    if (value === null) return null;
    total += value;
    matched = true;
  }
  return matched ? total : null;
}

function parsePart(part: string): number | null {
  if (UNICODE_FRACTIONS[part] !== undefined) return UNICODE_FRACTIONS[part];
  const glued = part.match(new RegExp(`^(\\d+)([${FRACTION_CHARS}])$`));
  if (glued) return Number(glued[1]) + UNICODE_FRACTIONS[glued[2]];
  const fraction = part.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);
  return /^\d+(\.\d+)?$/.test(part) ? Number(part) : null;
}

const DISPLAY_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
];

/** Formats for a cook: whole numbers plus a kitchen fraction, decimals only when nothing fits. */
export function formatAmount(amount: number): string {
  if (amount <= 0) return '0';
  const whole = Math.floor(amount + 1e-9);
  const rest = amount - whole;
  if (rest < 0.04) return String(whole);
  if (rest > 0.96) return String(whole + 1);
  const match = DISPLAY_FRACTIONS.find(([value]) => Math.abs(value - rest) < 0.04);
  if (match) return whole > 0 ? `${whole}${match[1]}` : match[1];
  if (amount >= 10) return String(Math.round(amount));
  return String(Math.round(amount * 100) / 100);
}
