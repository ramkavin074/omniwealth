// Minimal offline-friendly i18n. Default language is Tamil (`ta`) for the
// Kanyakumari shop owners; English (`en`) is the fallback and the dev
// language. Wording marked `// confirm with shop owners` is a best-effort
// guess and must be checked with the two pilot customers before launch.

import type { MovementReason, Unit } from './types';

export type Lang = 'ta' | 'en';

type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'Stock',
  'tab.home': 'Home',
  'tab.scan': 'Scan',
  'tab.adjust': 'Adjust',
  'tab.products': 'Products',

  'home.products': 'Products',
  'home.low': 'Low stock',
  'home.stockValue': 'Stock value',
  'home.today': "Today's changes",
  'home.activity': 'Recent activity',
  'home.noActivity': 'No stock changes yet',

  'history.title': 'Recent movements',
  'export.button': 'Export',

  'scan.cta': 'Scan barcode',
  'scan.manualEntry': 'Enter barcode',
  'scan.manualPrompt': 'Type or paste the barcode number',
  'scan.notFound': 'No product for this barcode',
  'scan.addNew': 'Add new product',
  'scan.scanning': 'Point the camera at a barcode',
  'scan.permissionDenied': 'Camera permission is needed to scan',
  'scan.again': 'Scan another',
  'scan.nameFromCatalogue': 'Name from online catalogue — please check it',
  'scan.undo': 'Undo',
  'scan.undone': 'Last change undone',

  'numpad.ok': 'OK',

  'bulk.enter': 'Rapid / stock-take',
  'bulk.title': 'Rapid scan',
  'bulk.exit': 'Exit',
  'bulk.mode.count': 'Count',
  'bulk.mode.in': 'Receive',
  'bulk.mode.out': 'Sell',
  'bulk.start': 'Start scanning',
  'bulk.stop': 'Stop',
  'bulk.scanned': '{name} ×{n}',
  'bulk.systemQty': 'system: {n}',
  'bulk.nothing': 'Nothing scanned yet',
  'bulk.applyCount': 'Apply count ({n} items)',
  'bulk.applied': 'Count applied',
  'bulk.diff': '{name}: {from} → {to}',
  'bulk.committed': '{n} units recorded',

  'product.name': 'Name',
  'product.price': 'Price (₹)',
  'product.mrp': 'MRP (₹)',
  'product.rate': 'Rate (₹)',
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

  'import.button': 'Import',
  'import.title': 'Import catalogue',
  'import.help':
    'Upload a CSV with columns: barcode, name, mrp, price, unit, opening_stock, low_stock_threshold. Only "name" is required. In Excel use File → Save As → CSV.',
  'import.downloadTemplate': 'Download template CSV',
  'import.chooseFile': 'Choose CSV file',
  'import.noNameColumn': 'The file needs a "name" column.',
  'import.noRows': 'No product rows found in the file.',
  'import.rowsFound': '{n} products ready to import',
  'import.ignoredColumns': 'Ignored columns',
  'import.confirm': 'Import now',
  'import.importing': 'Importing…',
  'import.added': 'Added',
  'import.updated': 'Updated',
  'import.skipped': 'Skipped',
  'import.done': 'Done',

  'adjust.pick': 'Choose a product',
  'adjust.search': 'Search by name or barcode',
  'adjust.change': 'Change',
  'adjust.setTo': 'Set stock to',
  'adjust.reason': 'Reason',
  'adjust.note': 'Note (optional)',
  'adjust.apply': 'Apply',
  'adjust.applied': 'Stock updated',
  'adjust.empty': 'No products yet. Scan an item or add one from the Products tab.',

  'list.search': 'Search products',
  'list.lowOnly': 'Low stock only',
  'list.empty': 'No products yet',
  'list.noMatch': 'Nothing matches your search',
  'list.lowBadge': 'Low',
  'list.inStock': 'in stock',
  'list.count': '{n} items',
  'list.addProduct': '+ Add',
  'sort.recent': 'Recent',
  'sort.name': 'A–Z',
  'sort.low': 'Low first',

  'settings.title': 'Settings',
  'settings.close': 'Close',
  'settings.defaults': 'New product defaults',
  'settings.data': 'Data',
  'settings.clearData': 'Clear all data',
  'settings.clearConfirm':
    'Delete every product and movement on this device? This cannot be undone.',
  'settings.account': 'Account',
  'settings.logout': 'Log out',

  'sync.title': 'Sync',
  'sync.now': 'Sync now',
  'sync.syncing': 'Syncing…',
  'sync.last': 'Last synced',
  'sync.never': 'never',
  'sync.justNow': 'just now',
  'sync.minsAgo': '{m}m ago',
  'sync.hoursAgo': '{h}h ago',
  'sync.result': 'Synced · {up} sent, {down} received',
  'sync.err.auth': 'Session expired — please log in again',
  'sync.err.network': 'No connection — will sync when back online',
  'sync.err.server': 'Sync failed, try again',

  'reason.opening': 'Opening stock',
  'reason.scan-in': 'Received',
  'reason.scan-out': 'Sold',
  'reason.manual': 'Manual change',
  'reason.correction': 'Correction',
  'reason.count': 'Stock-take',

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
  'tab.home': 'முகப்பு',
  'tab.scan': 'ஸ்கேன்',
  'tab.adjust': 'திருத்து',
  'tab.products': 'பொருட்கள்',

  'home.products': 'பொருட்கள்',
  'home.low': 'குறைந்த இருப்பு',
  'home.stockValue': 'இருப்பு மதிப்பு',
  'home.today': 'இன்றைய மாற்றங்கள்',
  'home.activity': 'சமீபத்திய செயல்பாடு',
  'home.noActivity': 'இன்னும் மாற்றங்கள் இல்லை',

  'history.title': 'சமீபத்திய மாற்றங்கள்',
  'export.button': 'ஏற்றுமதி',

  'scan.cta': 'பார்கோடு ஸ்கேன்',
  'scan.manualEntry': 'பார்கோடு உள்ளிடு',
  'scan.manualPrompt': 'பார்கோடு எண்ணை உள்ளிடவும்',
  'scan.notFound': 'இந்த பார்கோடுக்கு பொருள் இல்லை',
  'scan.addNew': 'புதிய பொருள் சேர்',
  'scan.scanning': 'கேமராவை பார்கோடு மீது காட்டவும்',
  'scan.permissionDenied': 'ஸ்கேன் செய்ய கேமரா அனுமதி தேவை',
  'scan.again': 'மீண்டும் ஸ்கேன்',
  'scan.nameFromCatalogue': 'ஆன்லைன் பட்டியலிலிருந்து பெயர் — சரிபார்க்கவும்',
  'scan.undo': 'திரும்பப்பெறு',
  'scan.undone': 'கடைசி மாற்றம் ரத்து செய்யப்பட்டது',

  'numpad.ok': 'சரி',

  'bulk.enter': 'வேகமான / எண்ணிக்கை',
  'bulk.title': 'வேக ஸ்கேன்',
  'bulk.exit': 'வெளியேறு',
  'bulk.mode.count': 'எண்ணிக்கை',
  'bulk.mode.in': 'வரவு',
  'bulk.mode.out': 'விற்பனை',
  'bulk.start': 'ஸ்கேன் தொடங்கு',
  'bulk.stop': 'நிறுத்து',
  'bulk.scanned': '{name} ×{n}',
  'bulk.systemQty': 'கணினி: {n}',
  'bulk.nothing': 'இன்னும் ஸ்கேன் செய்யவில்லை',
  'bulk.applyCount': 'எண்ணிக்கையை சேமி ({n})',
  'bulk.applied': 'எண்ணிக்கை சேமிக்கப்பட்டது',
  'bulk.diff': '{name}: {from} → {to}',
  'bulk.committed': '{n} பதிவு செய்யப்பட்டது',

  'product.name': 'பெயர்',
  'product.price': 'விலை (₹)',
  'product.mrp': 'அதிகபட்ச விலை (₹)',
  'product.rate': 'விற்பனை விலை (₹)',
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

  'import.button': 'இறக்குமதி',
  'import.title': 'பட்டியல் இறக்குமதி',
  'import.help':
    'CSV கோப்பை பதிவேற்றவும்: barcode, name, mrp, price, unit, opening_stock, low_stock_threshold. "name" மட்டும் அவசியம். Excel-ல் File → Save As → CSV.',
  'import.downloadTemplate': 'மாதிரி CSV பதிவிறக்கு',
  'import.chooseFile': 'CSV கோப்பை தேர்வு செய்',
  'import.noNameColumn': 'கோப்பில் "name" நெடுவரிசை தேவை.',
  'import.noRows': 'கோப்பில் பொருட்கள் எதுவும் இல்லை.',
  'import.rowsFound': '{n} பொருட்கள் இறக்குமதிக்கு தயார்',
  'import.ignoredColumns': 'புறக்கணிக்கப்பட்ட நெடுவரிசைகள்',
  'import.confirm': 'இப்போது இறக்குமதி செய்',
  'import.importing': 'இறக்குமதி ஆகிறது…',
  'import.added': 'சேர்க்கப்பட்டது',
  'import.updated': 'புதுப்பிக்கப்பட்டது',
  'import.skipped': 'தவிர்க்கப்பட்டது',
  'import.done': 'முடிந்தது',

  'adjust.pick': 'ஒரு பொருளை தேர்வு செய்',
  'adjust.search': 'பெயர் அல்லது பார்கோடு தேடு',
  'adjust.change': 'மாற்றம்',
  'adjust.setTo': 'இருப்பை அமை',
  'adjust.reason': 'காரணம்',
  'adjust.note': 'குறிப்பு (விருப்பம்)',
  'adjust.apply': 'சேமி',
  'adjust.applied': 'இருப்பு புதுப்பிக்கப்பட்டது',
  'adjust.empty':
    'இன்னும் பொருட்கள் இல்லை. ஸ்கேன் செய்யவும் அல்லது பொருட்கள் தாவலில் சேர்க்கவும்.',

  'list.search': 'பொருட்களை தேடு',
  'list.lowOnly': 'குறைந்த இருப்பு மட்டும்',
  'list.empty': 'இன்னும் பொருட்கள் இல்லை',
  'list.noMatch': 'தேடலுக்கு பொருத்தம் இல்லை',
  'list.lowBadge': 'குறைவு',
  'list.inStock': 'இருப்பு',
  'list.count': '{n} பொருட்கள்',
  'list.addProduct': '+ சேர்',
  'sort.recent': 'சமீபத்திய',
  'sort.name': 'அ–ஃ',
  'sort.low': 'குறைவு முதலில்',

  'settings.title': 'அமைப்புகள்',
  'settings.close': 'மூடு',
  'settings.defaults': 'புதிய பொருள் இயல்புநிலை',
  'settings.data': 'தரவு',
  'settings.clearData': 'அனைத்து தரவையும் அழி',
  'settings.clearConfirm':
    'இந்த சாதனத்தில் உள்ள அனைத்து பொருட்களையும் மாற்றங்களையும் அழிக்கவா? மீட்க முடியாது.',
  'settings.account': 'கணக்கு',
  'settings.logout': 'வெளியேறு',

  'sync.title': 'ஒத்திசைவு',
  'sync.now': 'இப்போது ஒத்திசை',
  'sync.syncing': 'ஒத்திசைக்கிறது…',
  'sync.last': 'கடைசி ஒத்திசைவு',
  'sync.never': 'இல்லை',
  'sync.justNow': 'இப்போது',
  'sync.minsAgo': '{m} நிமிடம் முன்பு',
  'sync.hoursAgo': '{h} மணி முன்பு',
  'sync.result': 'ஒத்திசைந்தது · {up} அனுப்பியது, {down} பெற்றது',
  'sync.err.auth': 'அமர்வு காலாவதியானது — மீண்டும் உள்நுழையவும்',
  'sync.err.network': 'இணைப்பு இல்லை — இணையம் வந்ததும் ஒத்திசைக்கும்',
  'sync.err.server': 'ஒத்திசைவு தோல்வி, மீண்டும் முயற்சிக்கவும்',

  'reason.opening': 'தொடக்க இருப்பு',
  'reason.scan-in': 'வரவு',
  'reason.scan-out': 'விற்பனை',
  'reason.manual': 'கைமுறை மாற்றம்',
  'reason.correction': 'திருத்தம்',
  'reason.count': 'சரக்கு எண்ணிக்கை',

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
