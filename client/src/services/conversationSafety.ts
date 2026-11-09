const CRISIS_PATTERNS = [
  /\b(?:i(?:'m| am)(?: feeling)? suicidal|i feel suicidal|i (?:have|am having) suicidal thoughts|i(?:'ve| have) been thinking about (?:suicide|killing myself|ending my life|hurting myself|harming myself)|i am thinking about (?:suicide|killing myself|ending my life|hurting myself|harming myself)|i'm thinking about (?:suicide|killing myself|ending my life|hurting myself|harming myself)|thinking about (?:suicide|killing myself|ending my life|hurting myself|harming myself)|i (?:intend to|plan to|might|could|will|am going to|'m going to|think i might|think i will) (?:kill myself|end my life|hurt myself|harm myself|commit suicide)|i am planning to (?:kill myself|end my life|hurt myself|harm myself)|i am considering (?:suicide|killing myself|ending my life|hurting myself|harming myself)|i'm considering (?:suicide|killing myself|ending my life|hurting myself|harming myself)|i feel like (?:killing myself|hurting myself|ending my life)|i want to (?:die|kill myself|end my life|hurt myself|harm myself))\b/i,
  /\b(?:i don't want to live|i do not want to live|i wish i (?:were|was) dead|my life isn't worth living)\b/i,
  /\b(?:i (?:already |just )?(?:overdosed|cut myself|hurt myself|harmed myself)|i took (?:too many|all|a lot of) (?:pills|medications?))\b/i,
  /\b(?:my (?:friend|partner|child|parent|sibling|roommate)|someone i know)\b.{0,70}\b(?:suicid(?:e|al)|kill (?:themselves|themself|himself|herself)|hurt (?:themselves|themself|himself|herself)|self[- ]harm|overdos(?:e|ing))\b/i,
  /\b(?:my (?:friend|partner|child|parent|sibling|roommate)|someone i know)\b.{0,70}\b(?:want(?:s)? to die|doesn't want to live|wants? to end (?:their|his|her) life)\b/i,
  /\b(?:i (?:might|want to|am going to|will|plan to) (?:hurt|harm|kill|attack) (?:someone|him|her|them|my (?:friend|partner|parent|boss)))\b/i,
  /\b(?:i am in immediate danger|i'm in immediate danger|i can't keep myself safe|i cannot keep myself safe)\b/i,
];

const EUROPEAN_UNION_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
]);

export type EmergencyCallOption = { number: string; region: string };
export type CrisisHelplineOption = {
  number: string;
  name: string;
  region: string;
  alternateCall?: { number: string; label: string };
  textNumber?: string;
  website: string;
};

function regionFromLocale(locale: string): string | null {
  for (const part of locale.toUpperCase().split(/[-_]/).slice(1)) {
    if (part.length === 1) break;
    if (/^[A-Z]{2}$/.test(part)) return part;
  }
  return null;
}

export function emergencyCallOptionForLocale(locale: string): EmergencyCallOption | null {
  const region = regionFromLocale(locale);
  if (!region) return null;
  if (region === 'IN') return { number: '112', region: 'India' };
  if (region === 'US' || region === 'CA') return { number: '911', region: region === 'US' ? 'United States' : 'Canada' };
  if (region === 'GB') return { number: '999', region: 'United Kingdom' };
  if (region === 'AU') return { number: '000', region: 'Australia' };
  if (region === 'NZ') return { number: '111', region: 'New Zealand' };
  if (EUROPEAN_UNION_REGIONS.has(region)) return { number: '112', region: 'European Union' };
  return null;
}

export function crisisHelplineOptionForLocale(locale: string): CrisisHelplineOption | null {
  const region = regionFromLocale(locale);
  if (region === 'IN') {
    return {
      number: '14416',
      name: 'Tele-MANAS',
      region: 'India',
      alternateCall: { number: '18008914416', label: '1-800 891 4416' },
      website: 'https://telemanas.mohfw.gov.in/',
    };
  }
  if (region === 'US') {
    return { number: '988', name: '988 Lifeline', region: 'United States', textNumber: '988', website: 'https://988lifeline.org/' };
  }
  if (region === 'CA') {
    return { number: '988', name: '988 Suicide Crisis Helpline', region: 'Canada', textNumber: '988', website: 'https://988.ca/' };
  }
  return null;
}

export function hasCrisisSignal(message: string): boolean {
  if (/^i(?:'m| am) not suicidal[.!]?$/i.test(message.trim())) return false;
  return /^\s*suicidal[.!]?\s*$/i.test(message)
    || CRISIS_PATTERNS.some(pattern => pattern.test(message));
}
