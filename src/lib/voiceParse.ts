// Turning a spoken shopping list (Tamil, Tanglish or English) into bill lines,
// and matching spoken names to catalogue products. Pure functions, no browser or
// device APIs, so every rule here is covered by unit tests.
//
// This is the offline path. When the phone is online the server matches the
// transcript against the catalogue with an AI model instead; this code is what
// keeps voice billing useful when the signal is weak.

export type SpokenUnit = 'kg' | 'g' | 'l' | 'ml' | 'count' | 'dozen';

export interface SpokenLine {
  /** Quantity, in `unit` when one was spoken (e.g. 250 with unit 'g'). */
  qty: number;
  /** The product words left once numbers, units and filler are removed. */
  name: string;
  unit?: SpokenUnit;
  /** A price the shopkeeper mentioned ("10 rupee biscuit"). Never a quantity. */
  price?: number;
}

// ---------------------------------------------------------------- numbers

const EN_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, half: 0.5, quarter: 0.25,
  'three-quarters': 0.75, 'three-quarter': 0.75,
};

// Tamil script: formal, colloquial and fractional forms.
const TA_NUM: Record<string, number> = {
  'ஒரு': 1, 'ஒன்று': 1, 'ஒண்ணு': 1, 'ஒன்னு': 1,
  'இரண்டு': 2, 'ரெண்டு': 2, 'ரண்டு': 2,
  'மூன்று': 3, 'மூணு': 3, 'மூனு': 3,
  'நான்கு': 4, 'நாலு': 4, 'நாளு': 4,
  'ஐந்து': 5, 'அஞ்சு': 5,
  'ஆறு': 6, 'ஏழு': 7, 'எழு': 7, 'எட்டு': 8,
  'ஒன்பது': 9, 'ஒம்போது': 9, 'ஒன்பத': 9,
  'பத்து': 10, 'பதினொன்று': 11, 'பதினொண்ணு': 11,
  'பன்னிரண்டு': 12, 'பன்னெண்டு': 12,
  'பதிமூன்று': 13, 'பதிமூணு': 13, 'பதினான்கு': 14, 'பதினாலு': 14,
  'பதினைந்து': 15, 'பதினஞ்சு': 15, 'பதினாறு': 16, 'பதினேழு': 17, 'பதினெட்டு': 18, 'பத்தொன்பது': 19,
  'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'நாப்பது': 40, 'ஐம்பது': 50, 'அம்பது': 50,
  'அறுபது': 60, 'எழுபது': 70, 'எண்பது': 80, 'தொண்ணூறு': 90, 'நூறு': 100,
  'அரை': 0.5, 'கால்': 0.25, 'முக்கால்': 0.75,
  'ஒன்றரை': 1.5, 'ஒண்ணரை': 1.5, 'ஒன்னரை': 1.5,
  'இரண்டரை': 2.5, 'ரெண்டரை': 2.5,
  'மூன்றரை': 3.5, 'மூணரை': 3.5,
  'நான்கரை': 4.5, 'நாலரை': 4.5,
  'ஐந்தரை': 5.5, 'அஞ்சரை': 5.5,
  'ஒன்றேகால்': 1.25, 'ஒண்ணேகால்': 1.25, 'இரண்டேகால்': 2.25, 'ரெண்டேகால்': 2.25,
};

// Tamil spoken in Latin letters (what people type / what some recognisers return).
const TANGLISH_NUM: Record<string, number> = {
  oru: 1, onnu: 1, ondru: 1, ondra: 1,
  rendu: 2, randu: 2, irandu: 2,
  moonu: 3, munu: 3, moondru: 3, moonru: 3,
  naalu: 4, nalu: 4, naangu: 4, nangu: 4,
  anju: 5, ainthu: 5, aindhu: 5,
  aaru: 6, aru: 6, ezhu: 7, yezhu: 7, ettu: 8,
  onbathu: 9, onbadhu: 9, ombodhu: 9, ombathu: 9,
  pathu: 10, padhu: 10, pathinonnu: 11, pannendu: 12, pathinanju: 15,
  irubathu: 20, muppathu: 30, naarpathu: 40, nalupathu: 40, aimbathu: 50, nooru: 100,
  arai: 0.5, ara: 0.5, kaal: 0.25, kal: 0.25, mukkaal: 0.75,
  onnara: 1.5, ondrara: 1.5, rendara: 2.5, moonara: 3.5, onnekaal: 1.25,
};

const TA_DIGITS = '௦௧௨௩௪௫௬௭௮௯';

function normaliseDigits(s: string): string {
  let out = '';
  for (const ch of s) {
    const i = TA_DIGITS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out;
}

function wordToNum(tk: string): number | null {
  if (/^\d+(\.\d+)?$/.test(tk)) {
    const n = Number(tk);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return EN_NUM[tk] ?? TA_NUM[tk] ?? TANGLISH_NUM[tk] ?? null;
}

// ---------------------------------------------------------------- units

const UNIT_MAP: Record<string, SpokenUnit> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', 'கிலோ': 'kg', 'கிலோகிராம்': 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', 'கிராம்': 'g',
  l: 'l', lt: 'l', ltr: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l', 'லிட்டர்': 'l', 'லிட்டர': 'l',
  ml: 'ml', 'மில்லி': 'ml', 'மில்லிலிட்டர்': 'ml',
  packet: 'count', packets: 'count', pack: 'count', packs: 'count', piece: 'count', pieces: 'count',
  pcs: 'count', pc: 'count', box: 'count', boxes: 'count', nos: 'count', no: 'count', unit: 'count',
  units: 'count', bottle: 'count', bottles: 'count',
  'பாக்கெட்': 'count', 'பாக்கெட்டு': 'count', 'பீஸ்': 'count', 'டப்பா': 'count', 'பாட்டில்': 'count',
  'பெட்டி': 'count', 'எண்ணம்': 'count',
  dozen: 'dozen', 'டஜன்': 'dozen',
};

const RUPEE_WORDS = new Set(['ரூபாய்', 'ரூபாய', 'ரூபா', 'ரூவா', 'rupee', 'rupees', 'rupay', 'rs', 'rs.', '₹']);

const NOISE = new Set([
  'of', 'a', 'an', 'x', 'the', 'please', 'add', 'give', 'and', 'me', 'need', 'want', 'one more',
  'வேண்டும்', 'வேணும்', 'வேண்டாம்', 'தாங்க', 'தாருங்கள்', 'கொடுங்க', 'கொடு', 'குடு', 'குடுங்க', 'போடு', 'போடுங்க',
  'எடு', 'எடுங்க', 'கொஞ்சம்', 'நல்ல', 'பா', 'அண்ணா', 'அக்கா',
  'venum', 'vendum', 'kudunga', 'kodunga', 'kudu', 'kodu', 'podunga', 'podu', 'thanga', 'tharunga', 'anna', 'akka',
]);

const SEPARATORS =
  /\s*(?:,|&|;|\band\b|\bplus\b|\bthen\b|\bnext\b|\balso\b|மற்றும்|அப்புறம்|அப்புறமா|பிறகு|அடுத்து|\n)\s*/i;

// ---------------------------------------------------------------- parsing

function preNormalise(text: string): string {
  let s = normaliseDigits(text.toLowerCase());
  // "one and a half kg" -> "1.5 kg" (before 'and' is treated as a separator)
  s = s.replace(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+and\s+a\s+half\b/g, (_m, n) => {
    const base = wordToNum(n);
    return base === null ? _m : String(base + 0.5);
  });
  s = s.replace(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+and\s+a\s+quarter\b/g, (_m, n) => {
    const base = wordToNum(n);
    return base === null ? _m : String(base + 0.25);
  });
  // "₹10" -> "10 ₹" so the rupee sign reads as a price marker after the number
  s = s.replace(/₹\s*(\d+(?:\.\d+)?)/g, '$1 ₹');
  // strip punctuation that recognisers add, keep decimal points
  s = s.replace(/[!?"“”()]/g, ' ').replace(/(?<!\d)\.(?!\d)/g, ' ');
  return s;
}

function parseFragment(frag: string): SpokenLine | null {
  const toks = frag.trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return null;

  let qty: number | null = null;
  let qtyIdx = -1;
  let price: number | undefined;
  let priceIdx = -1;

  for (let i = 0; i < toks.length; i++) {
    const n = wordToNum(toks[i]);
    if (n === null) continue;
    // A number followed by "rupees" is a price, not a quantity.
    if (RUPEE_WORDS.has(toks[i + 1] ?? '')) {
      if (price === undefined) {
        price = n;
        priceIdx = i;
      }
      continue;
    }
    if (qty === null) {
      qty = n;
      qtyIdx = i;
    }
  }

  // The unit is the unit word next to the quantity, if any; other unit words are just removed.
  let unit: SpokenUnit | undefined;
  const near = [qtyIdx + 1, qtyIdx - 1];
  for (const j of near) {
    if (qtyIdx >= 0 && toks[j] && UNIT_MAP[toks[j]]) {
      unit = UNIT_MAP[toks[j]];
      break;
    }
  }
  // "dozen eggs" with no number: one dozen.
  if (qty === null && toks.some((t) => UNIT_MAP[t] === 'dozen')) {
    qty = 1;
    unit = 'dozen';
  }

  const name = toks
    .filter(
      (tk, i) =>
        i !== qtyIdx && i !== priceIdx && !UNIT_MAP[tk] && !RUPEE_WORDS.has(tk) && !NOISE.has(tk),
    )
    .join(' ')
    .trim();
  if (!name) return null;

  const line: SpokenLine = { qty: qty !== null && qty > 0 ? qty : 1, name };
  if (unit) line.unit = unit;
  if (price !== undefined) line.price = price;
  return line;
}

/** Break one spoken utterance into billable lines.
 *  "2 kg sugar and one colgate, 5 wedding cards" -> sugar x2 kg, colgate x1, wedding cards x5. */
export function parseSpokenItems(text: string): SpokenLine[] {
  return preNormalise(text)
    .split(SEPARATORS)
    .map(parseFragment)
    .filter((l): l is SpokenLine => l != null);
}

// ---------------------------------------------------------------- units -> product units

/**
 * Express a spoken quantity in the product's own unit. Speaking "250 grams" of an
 * item sold by the kilo is 0.25, not 250. If the spoken unit cannot be turned into
 * the product's unit (say "half a kilo" for something sold per packet), quantity 1
 * is used and `exact` is false so the cashier can adjust it.
 */
export function convertQty(
  line: { qty: number; unit?: SpokenUnit },
  productUnit: string,
): { qty: number; exact: boolean } {
  const { qty, unit } = line;
  if (!unit || unit === 'count') return { qty, exact: true };
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const counted = productUnit === 'piece' || productUnit === 'packet' || productUnit === 'box' || productUnit === 'dozen';

  switch (unit) {
    case 'kg':
      return productUnit === 'kg' ? { qty, exact: true } : { qty: 1, exact: false };
    case 'g':
      return productUnit === 'kg' ? { qty: round(qty / 1000), exact: true } : { qty: 1, exact: false };
    case 'l':
      return productUnit === 'liter' ? { qty, exact: true } : { qty: 1, exact: false };
    case 'ml':
      return productUnit === 'liter' ? { qty: round(qty / 1000), exact: true } : { qty: 1, exact: false };
    case 'dozen':
      if (productUnit === 'dozen') return { qty, exact: true };
      if (counted) return { qty: qty * 12, exact: true };
      return { qty: 1, exact: false };
  }
}

// ---------------------------------------------------------------- matching

/**
 * Spoken Tamil word -> the English word shops usually print on the product.
 * Several spellings may share one entry. Longer phrases are tried before single words.
 */
const ALIAS_GROUPS: [string[], string[]][] = [
  [['பால்', 'paal', 'pal'], ['milk']],
  [['தயிர்', 'thayir', 'tayir'], ['curd', 'yogurt']],
  [['மோர்', 'mor', 'moru'], ['buttermilk']],
  [['நெய்', 'nei', 'ney'], ['ghee']],
  [['வெண்ணெய்', 'vennai', 'venney'], ['butter']],
  [['சர்க்கரை', 'சக்கரை', 'சீனி', 'sarkarai', 'sakkarai', 'seeni', 'cheeni'], ['sugar']],
  [['வெல்லம்', 'vellam'], ['jaggery']],
  [['உப்பு', 'uppu'], ['salt']],
  [['அரிசி', 'arisi'], ['rice']],
  [['பச்சரிசி', 'pacharisi', 'pachai arisi'], ['raw rice', 'rice']],
  [['புழுங்கல் அரிசி', 'pulungal arisi'], ['boiled rice', 'rice']],
  [['பொன்னி', 'ponni'], ['ponni']],
  [['பாசுமதி', 'basmathi'], ['basmati']],
  [['கோதுமை', 'godhumai', 'gothumai'], ['wheat']],
  [['ஆட்டா', 'attaa'], ['atta']],
  [['மாவு', 'maavu', 'mavu'], ['flour', 'maavu']],
  [['ரவை', 'ravai'], ['rava', 'sooji']],
  [['மைதா'], ['maida']],
  [['சேமியா', 'semiya'], ['vermicelli', 'semiya']],
  [['பருப்பு', 'paruppu'], ['dal']],
  [['துவரம் பருப்பு', 'thuvaram paruppu', 'thuvaram'], ['toor dal', 'dal']],
  [['உளுந்து', 'உளுத்தம் பருப்பு', 'ulundhu', 'ulutham paruppu'], ['urad', 'dal']],
  [['பாசிப்பருப்பு', 'பாசி பருப்பு', 'pasi paruppu'], ['moong', 'dal']],
  [['கடலைப்பருப்பு', 'கடலை பருப்பு', 'kadalai paruppu'], ['chana dal', 'dal']],
  [['கடலை', 'kadalai'], ['chana', 'groundnut']],
  [['பட்டாணி', 'pattani'], ['peas']],
  [['எண்ணெய்', 'எண்ணை', 'ennai', 'enna'], ['oil']],
  [['நல்லெண்ணெய்', 'நல்லெண்ணை', 'nallennai'], ['gingelly oil', 'sesame oil', 'oil']],
  [['தேங்காய் எண்ணெய்', 'thengai ennai'], ['coconut oil', 'oil']],
  [['கடலை எண்ணெய்', 'kadalai ennai'], ['groundnut oil', 'oil']],
  [['தேங்காய்', 'thengai'], ['coconut']],
  [['தேயிலை', 'டீ தூள்', 'டீ', 'tea thool'], ['tea']],
  [['காபி', 'kaapi', 'coffee'], ['coffee']],
  [['சோப்பு', 'soppu'], ['soap']],
  [['பற்பசை', 'பேஸ்ட்', 'paste', 'patpasai'], ['paste', 'toothpaste']],
  [['ஷாம்பு', 'shampu'], ['shampoo']],
  [['பிஸ்கட்', 'biscut', 'biskut'], ['biscuit']],
  [['ரொட்டி', 'பிரெட்', 'bread', 'rotti'], ['bread']],
  [['முட்டை', 'muttai'], ['egg']],
  [['வெங்காயம்', 'vengayam'], ['onion']],
  [['சின்ன வெங்காயம்', 'chinna vengayam'], ['shallot', 'onion']],
  [['தக்காளி', 'thakkali'], ['tomato']],
  [['உருளைக்கிழங்கு', 'உருளை', 'urulai'], ['potato']],
  [['மிளகாய்', 'milagai'], ['chilli', 'chili']],
  [['மிளகாய் தூள்', 'milagai thool'], ['chilli powder', 'chilli']],
  [['மஞ்சள்', 'manjal'], ['turmeric']],
  [['மல்லி', 'malli', 'தனியா'], ['coriander']],
  [['சீரகம்', 'seeragam'], ['cumin', 'jeera']],
  [['கடுகு', 'kadugu'], ['mustard']],
  [['மிளகு', 'milagu'], ['pepper']],
  [['புளி', 'puli'], ['tamarind']],
  [['பெருங்காயம்', 'perungayam'], ['hing', 'asafoetida']],
  [['தண்ணீர்', 'thanni', 'thaneer'], ['water']],
  [['சலவை சோப்பு', 'சலவைத்தூள்'], ['detergent', 'washing']],
  [['பேனா', 'pena'], ['pen']],
  [['நோட்டு', 'notebook', 'நோட்டுப் புத்தகம்'], ['notebook']],
  [['மெழுகுவர்த்தி', 'candle'], ['candle']],
  [['தீப்பெட்டி', 'theepetti', 'theeppetti'], ['matchbox', 'match']],
];

const ALIASES = new Map<string, string[]>();
for (const [spoken, english] of ALIAS_GROUPS) for (const s of spoken) ALIASES.set(s.toLowerCase(), english);

// Consonant skeleton: lets a brand heard in Tamil (கோல்கேட்) meet the English name
// on the product (Colgate). Tamil script does not separate g/k, d/t, b/p, so neither
// does the skeleton. Vowels are dropped and repeats collapsed.
const TA_CONSONANT: Record<string, string> = {
  'க': 'k', 'ங': 'n', 'ச': 's', 'ஞ': 'n', 'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ப': 'p', 'ம': 'm',
  'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'l', 'ள': 'l', 'ற': 'r', 'ன': 'n', 'ஜ': 's', 'ஷ': 's', 'ஸ': 's', 'ஹ': '',
};

export function skeleton(word: string): string {
  let s = word.toLowerCase();
  // Latin digraphs first
  s = s.replace(/sh|ch|zh/g, (m) => (m === 'zh' ? 'l' : 's')).replace(/th|dh|kh|gh|bh|ph|ck/g, (m) => {
    switch (m) {
      case 'th':
      case 'dh':
        return 't';
      case 'kh':
      case 'gh':
      case 'ck':
        return 'k';
      default:
        return 'p'; // bh, ph
    }
  });
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (TA_CONSONANT[ch] !== undefined) {
      out += TA_CONSONANT[ch];
      continue;
    }
    if (ch === 'ஃ' && s[i + 1] === 'ப') continue; // ஃப (f) -> p, handled by ப
    if (/[a-z]/.test(ch)) {
      switch (ch) {
        case 'c':
          out += /[eiy]/.test(s[i + 1] ?? '') ? 's' : 'k';
          break;
        case 'g':
        case 'q':
          out += 'k';
          break;
        case 'd':
          out += 't';
          break;
        case 'b':
        case 'f':
          out += 'p';
          break;
        case 'j':
        case 'z':
          out += 's';
          break;
        case 'w':
          out += 'v';
          break;
        case 'x':
          out += 'ks';
          break;
        case 'a': case 'e': case 'i': case 'o': case 'u': case 'y': case 'h':
          break; // vowels (and the silent h of digraphs) carry no consonant
        default:
          out += ch; // k l m n p r s t v
      }
    }
    // other characters (Tamil vowel signs, pulli, digits, spaces) are dropped
  }
  return out.replace(/(.)\1+/g, '$1');
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function wordsOf(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

function tokenScore(spoken: string, product: string): number {
  if (spoken === product) return 1;
  if (spoken.length >= 3 && (product.startsWith(spoken) || spoken.startsWith(product)) && Math.min(spoken.length, product.length) >= 3) return 0.9;
  if (spoken.length >= 4 && product.includes(spoken)) return 0.8;
  const a = skeleton(spoken);
  const b = skeleton(product);
  if (a.length >= 3 && b.length >= 3) {
    if (a === b) return 0.85;
    const sim = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    if (sim >= 0.75) return 0.6 + 0.2 * sim; // 0.75 -> 0.75 ... 1 -> 0.8
  }
  // Very short skeletons (Maggi -> "mk") are weak evidence: only equal ones, and only
  // between words long enough that it is unlikely to be chance.
  if (a.length === 2 && a === b && spoken.length >= 3 && product.length >= 4) return 0.7;
  return 0;
}

/** Each spoken word or phrase becomes a group of alternatives (itself + English aliases). */
function spokenGroups(spokenName: string): string[][] {
  const words = wordsOf(spokenName);
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i++) {
    const two = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : '';
    if (two && ALIASES.has(two)) {
      groups.push([...(ALIASES.get(two) as string[]).flatMap(wordsOf), words[i], words[i + 1]]);
      i++;
    } else if (ALIASES.has(words[i])) {
      groups.push([...(ALIASES.get(words[i]) as string[]).flatMap(wordsOf), words[i]]);
    } else {
      groups.push([words[i]]);
    }
  }
  return groups;
}

/** How well a spoken name matches a product name: 0 (not at all) .. 1 (exact). */
export function matchScore(spokenName: string, productName: string): number {
  const groups = spokenGroups(spokenName);
  const pwords = wordsOf(productName);
  if (groups.length === 0 || pwords.length === 0) return 0;
  let total = 0;
  for (const alts of groups) {
    let best = 0;
    for (const alt of alts) for (const pw of pwords) best = Math.max(best, tokenScore(alt, pw));
    total += best;
  }
  const coverage = total / groups.length;
  // Prefer the plainer name when scores tie ("Milk" over "Milk Bikis").
  return Math.max(0, coverage - 0.01 * Math.max(0, pwords.length - groups.length));
}

/** Accept a match only if it is clearly the same thing. */
export const MATCH_THRESHOLD = 0.6;

/**
 * Best catalogue match for a spoken name, or null. When the shopkeeper also said a
 * price ("10 rupee biscuit"), products at that price win ties.
 */
export function bestMatch<T extends { name: string; price?: number }>(
  products: T[],
  spokenName: string,
  priceHint?: number,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const p of products) {
    let s = matchScore(spokenName, p.name);
    if (s <= 0) continue;
    if (priceHint !== undefined && p.price !== undefined && Math.abs(p.price - priceHint) < 0.01) s += 0.05;
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
