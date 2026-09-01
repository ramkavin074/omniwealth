// Minimal offline-friendly i18n. Default language is Tamil (`ta`) for the
// Kanyakumari shop owners; English (`en`) is the fallback and the dev
// language. Wording marked `// confirm with shop owners` is a best-effort
// guess and must be checked with the two pilot customers before launch.

import type { MovementReason, Unit } from './types';

export type Lang = 'ta' | 'en';

type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'Stock',
  'tab.scan': 'Scan',
  'tab.adjust': 'Adjust',
  'tab.products': 'Products',

  'scan.cta': 'Scan barcode',
  'scan.manualEntry': 'Enter barcode',
  'scan.manualPrompt': 'Type or paste the barcode number',
  'scan.notFound': 'No product for this barcode',
  'scan.addNew': 'Add new product',
  'scan.scanning': 'Point the camera at a barcode',
  'scan.permissionDenied': 'Camera permission is needed to scan',
  'scan.again': 'Scan another',

  'product.name': 'Name',
  'product.price': 'Price (₹)',
  'product.stock': 'Stock',
  'product.unit': 'Unit',
  'product.openingStock': 'Opening stock',
  'product.lowStockThreshold': 'Low-stock alert at',
  'product.barcode': 'Barcode',
  'product.noBarcode': 'No barcode',
  'product.save': 'Save',
  'product.cancel': 'Cancel',
  'product.saved': 'Saved',
  'product.delete': 'Delete',
  'product.deleteConfirm': 'Delete this product?',

  'adjust.pick': 'Choose a product',
  'adjust.search': 'Search by name or barcode',
  'adjust.change': 'Change',
  'adjust.setTo': 'Set stock to',
  'adjust.reason': 'Reason',
  'adjust.note': 'Note (optional)',
  'adjust.apply': 'Apply',
  'adjust.applied': 'Stock updated',
  'adjust.empty': 'No products yet. Add one from the Scan tab.',

  'list.search': 'Search products',
  'list.lowOnly': 'Low stock only',
  'list.empty': 'No products yet',
  'list.noMatch': 'Nothing matches your search',
  'list.lowBadge': 'Low',
  'list.inStock': 'in stock',

  'reason.opening': 'Opening stock',
  'reason.scan-in': 'Received',
  'reason.scan-out': 'Sold',
  'reason.manual': 'Manual change',
  'reason.correction': 'Correction',

  'unit.piece': 'piece',
  'unit.kg': 'kg',
  'unit.liter': 'liter',
  'unit.packet': 'packet',
  'unit.box': 'box',
  'unit.dozen': 'dozen',

  'common.plus': '+',
  'common.minus': '−',
  'lang.toggle': 'தமிழ்',
};

// confirm with shop owners — every Tamil string below is a first draft.
const ta: Dict = {
  'app.title': 'சரக்கு',
  'tab.scan': 'ஸ்கேன்',
  'tab.adjust': 'திருத்து',
  'tab.products': 'பொருட்கள்',

  'scan.cta': 'பார்கோடு ஸ்கேன்',
  'scan.manualEntry': 'பார்கோடு உள்ளிடு',
  'scan.manualPrompt': 'பார்கோடு எண்ணை உள்ளிடவும்',
  'scan.notFound': 'இந்த பார்கோடுக்கு பொருள் இல்லை',
  'scan.addNew': 'புதிய பொருள் சேர்',
  'scan.scanning': 'கேமராவை பார்கோடு மீது காட்டவும்',
  'scan.permissionDenied': 'ஸ்கேன் செய்ய கேமரா அனுமதி தேவை',
  'scan.again': 'மீண்டும் ஸ்கேன்',

  'product.name': 'பெயர்',
  'product.price': 'விலை (₹)',
  'product.stock': 'இருப்பு',
  'product.unit': 'அளவு',
  'product.openingStock': 'தொடக்க இருப்பு',
  'product.lowStockThreshold': 'குறைந்த இருப்பு எச்சரிக்கை',
  'product.barcode': 'பார்கோடு',
  'product.noBarcode': 'பார்கோடு இல்லை',
  'product.save': 'சேமி',
  'product.cancel': 'ரத்து',
  'product.saved': 'சேமிக்கப்பட்டது',
  'product.delete': 'நீக்கு',
  'product.deleteConfirm': 'இந்த பொருளை நீக்கவா?',

  'adjust.pick': 'ஒரு பொருளை தேர்வு செய்',
  'adjust.search': 'பெயர் அல்லது பார்கோடு தேடு',
  'adjust.change': 'மாற்றம்',
  'adjust.setTo': 'இருப்பை அமை',
  'adjust.reason': 'காரணம்',
  'adjust.note': 'குறிப்பு (விருப்பம்)',
  'adjust.apply': 'சேமி',
  'adjust.applied': 'இருப்பு புதுப்பிக்கப்பட்டது',
  'adjust.empty': 'இன்னும் பொருட்கள் இல்லை. ஸ்கேன் தாவலில் சேர்க்கவும்.',

  'list.search': 'பொருட்களை தேடு',
  'list.lowOnly': 'குறைந்த இருப்பு மட்டும்',
  'list.empty': 'இன்னும் பொருட்கள் இல்லை',
  'list.noMatch': 'தேடலுக்கு பொருத்தம் இல்லை',
  'list.lowBadge': 'குறைவு',
  'list.inStock': 'இருப்பு',

  'reason.opening': 'தொடக்க இருப்பு',
  'reason.scan-in': 'வரவு',
  'reason.scan-out': 'விற்பனை',
  'reason.manual': 'கைமுறை மாற்றம்',
  'reason.correction': 'திருத்தம்',

  'unit.piece': 'எண்ணிக்கை',
  'unit.kg': 'கிலோ',
  'unit.liter': 'லிட்டர்',
  'unit.packet': 'பாக்கெட்',
  'unit.box': 'பெட்டி',
  'unit.dozen': 'டசன்',

  'common.plus': '+',
  'common.minus': '−',
  'lang.toggle': 'EN',
};

const DICTS: Record<Lang, Dict> = { en, ta };

const LANG_KEY = 'stocking.lang';

export function getLang(): Lang {
  if (typeof localStorage === 'undefined') return 'ta';
  const v = localStorage.getItem(LANG_KEY);
  return v === 'en' || v === 'ta' ? v : 'ta';
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage unavailable — fall back to in-memory default */
  }
}

/** Translate a key for `lang`, falling back to English then the raw key. */
export function t(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? en[key] ?? key;
}

export function unitLabel(lang: Lang, unit: Unit): string {
  return t(lang, `unit.${unit}`);
}

export function reasonLabel(lang: Lang, reason: MovementReason): string {
  return t(lang, `reason.${reason}`);
}
