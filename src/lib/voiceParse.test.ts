import { describe, expect, it } from 'vitest';
import { bestMatch, convertQty, matchScore, parseSpokenItems, skeleton } from './voiceParse';

describe('parseSpokenItems — English (existing behaviour kept)', () => {
  it('splits a spoken list into lines', () => {
    expect(parseSpokenItems('2 kg sugar and one colgate, 5 wedding cards')).toEqual([
      { qty: 2, name: 'sugar', unit: 'kg' },
      { qty: 1, name: 'colgate' },
      { qty: 5, name: 'wedding cards' },
    ]);
  });

  it('reads a trailing quantity and drops filler words', () => {
    expect(parseSpokenItems('please add sugar 3 packets')).toEqual([{ qty: 3, name: 'sugar', unit: 'count' }]);
  });

  it('understands "one and a half"', () => {
    expect(parseSpokenItems('one and a half kg rice')).toEqual([{ qty: 1.5, name: 'rice', unit: 'kg' }]);
  });

  it('defaults to one and returns nothing for empty speech', () => {
    expect(parseSpokenItems('soap')).toEqual([{ qty: 1, name: 'soap' }]);
    expect(parseSpokenItems('   ')).toEqual([]);
  });
});

describe('parseSpokenItems — Tamil', () => {
  it('reads formal and colloquial number words', () => {
    expect(parseSpokenItems('இரண்டு கிலோ சர்க்கரை')).toEqual([{ qty: 2, name: 'சர்க்கரை', unit: 'kg' }]);
    expect(parseSpokenItems('மூணு பாக்கெட் பால்')).toEqual([{ qty: 3, name: 'பால்', unit: 'count' }]);
    expect(parseSpokenItems('அஞ்சு சோப்பு')).toEqual([{ qty: 5, name: 'சோப்பு' }]);
    expect(parseSpokenItems('இருபது முட்டை')).toEqual([{ qty: 20, name: 'முட்டை' }]);
  });

  it('reads fractions of a kilo', () => {
    expect(parseSpokenItems('அரை கிலோ அரிசி')).toEqual([{ qty: 0.5, name: 'அரிசி', unit: 'kg' }]);
    expect(parseSpokenItems('கால் கிலோ மிளகாய்')).toEqual([{ qty: 0.25, name: 'மிளகாய்', unit: 'kg' }]);
    expect(parseSpokenItems('முக்கால் கிலோ புளி')).toEqual([{ qty: 0.75, name: 'புளி', unit: 'kg' }]);
    expect(parseSpokenItems('ஒன்றரை கிலோ தக்காளி')).toEqual([{ qty: 1.5, name: 'தக்காளி', unit: 'kg' }]);
    expect(parseSpokenItems('இரண்டரை லிட்டர் பால்')).toEqual([{ qty: 2.5, name: 'பால்', unit: 'l' }]);
  });

  it('keeps grams as grams (converted later, per product)', () => {
    expect(parseSpokenItems('250 கிராம் டீ தூள்')).toEqual([{ qty: 250, name: 'டீ தூள்', unit: 'g' }]);
  });

  it('reads Tamil digits', () => {
    expect(parseSpokenItems('௨ கிலோ அரிசி')).toEqual([{ qty: 2, name: 'அரிசி', unit: 'kg' }]);
  });

  it('treats "10 rupees" as a price, never a quantity', () => {
    expect(parseSpokenItems('பத்து ரூபாய் பிஸ்கட்')).toEqual([{ qty: 1, name: 'பிஸ்கட்', price: 10 }]);
    expect(parseSpokenItems('ten rupee biscuit')).toEqual([{ qty: 1, name: 'biscuit', price: 10 }]);
    expect(parseSpokenItems('₹20 chocolate')).toEqual([{ qty: 1, name: 'chocolate', price: 20 }]);
    expect(parseSpokenItems('2 பத்து ரூபாய் பிஸ்கட்')).toEqual([{ qty: 2, name: 'பிஸ்கட்', price: 10 }]);
  });

  it('drops polite filler and splits on spoken separators', () => {
    expect(parseSpokenItems('ரெண்டு பாக்கெட் பால் குடுங்க')).toEqual([{ qty: 2, name: 'பால்', unit: 'count' }]);
    expect(parseSpokenItems('பால் ரெண்டு அப்புறம் தயிர் ஒண்ணு')).toEqual([
      { qty: 2, name: 'பால்' },
      { qty: 1, name: 'தயிர்' },
    ]);
  });

  it('reads dozens', () => {
    expect(parseSpokenItems('இரண்டு டஜன் முட்டை')).toEqual([{ qty: 2, name: 'முட்டை', unit: 'dozen' }]);
    expect(parseSpokenItems('dozen eggs')).toEqual([{ qty: 1, name: 'eggs', unit: 'dozen' }]);
  });
});

describe('parseSpokenItems — Tamil in Latin letters', () => {
  it('reads Tanglish numbers and fractions', () => {
    expect(parseSpokenItems('rendu kilo sugar')).toEqual([{ qty: 2, name: 'sugar', unit: 'kg' }]);
    expect(parseSpokenItems('arai kilo arisi')).toEqual([{ qty: 0.5, name: 'arisi', unit: 'kg' }]);
    expect(parseSpokenItems('moonu packet paal kudunga')).toEqual([{ qty: 3, name: 'paal', unit: 'count' }]);
    expect(parseSpokenItems('kaal kilo milagai')).toEqual([{ qty: 0.25, name: 'milagai', unit: 'kg' }]);
    expect(parseSpokenItems('onnara kilo thakkali')).toEqual([{ qty: 1.5, name: 'thakkali', unit: 'kg' }]);
  });
});

describe('convertQty', () => {
  it('turns grams and millilitres into the product unit', () => {
    expect(convertQty({ qty: 250, unit: 'g' }, 'kg')).toEqual({ qty: 0.25, exact: true });
    expect(convertQty({ qty: 500, unit: 'ml' }, 'liter')).toEqual({ qty: 0.5, exact: true });
    expect(convertQty({ qty: 2, unit: 'kg' }, 'kg')).toEqual({ qty: 2, exact: true });
    expect(convertQty({ qty: 2, unit: 'l' }, 'liter')).toEqual({ qty: 2, exact: true });
  });

  it('keeps plain counts, and turns dozens into pieces', () => {
    expect(convertQty({ qty: 3 }, 'piece')).toEqual({ qty: 3, exact: true });
    expect(convertQty({ qty: 3, unit: 'count' }, 'packet')).toEqual({ qty: 3, exact: true });
    expect(convertQty({ qty: 2, unit: 'dozen' }, 'piece')).toEqual({ qty: 24, exact: true });
    expect(convertQty({ qty: 2, unit: 'dozen' }, 'dozen')).toEqual({ qty: 2, exact: true });
  });

  it('falls back to 1 (flagged) when the units cannot be compared', () => {
    expect(convertQty({ qty: 500, unit: 'g' }, 'packet')).toEqual({ qty: 1, exact: false });
    expect(convertQty({ qty: 2, unit: 'kg' }, 'liter')).toEqual({ qty: 1, exact: false });
  });
});

describe('skeleton', () => {
  it('lets a brand heard in Tamil meet its English spelling', () => {
    expect(skeleton('கோல்கேட்')).toBe(skeleton('Colgate'));
    expect(skeleton('சர்ஃப்')).toBe(skeleton('Surf'));
    expect(skeleton('மேகி')).toBe(skeleton('Maggi'));
    expect(skeleton('ஹார்லிக்ஸ்')).toBe(skeleton('Horlicks'));
    expect(skeleton('டெட்டால்')).toBe(skeleton('Dettol'));
    expect(skeleton('பூஸ்ட்')).toBe(skeleton('Boost'));
    expect(skeleton('பிரிட்டானியா')).toBe(skeleton('Britannia'));
    expect(skeleton('பார்லே')).toBe(skeleton('Parle'));
  });
});

describe('bestMatch — spoken name to catalogue product', () => {
  const catalogue = [
    { name: 'Sugar 1kg', price: 48 },
    { name: 'Salt Tata 1kg', price: 24 },
    { name: 'Milk Aavin 500ml', price: 30 },
    { name: 'Colgate Strong 100g', price: 55 },
    { name: 'Closeup 100g', price: 60 },
    { name: 'Surf Excel 1kg', price: 150 },
    { name: 'Maggi Noodles', price: 14 },
    { name: 'Biscuit Parle-G', price: 10 },
    { name: 'Biscuit Good Day', price: 20 },
    { name: 'Toor Dal 1kg', price: 140 },
    { name: 'Gingelly Oil 1L', price: 320 },
  ];

  it('finds products from Tamil words', () => {
    expect(bestMatch(catalogue, 'சர்க்கரை')?.name).toBe('Sugar 1kg');
    expect(bestMatch(catalogue, 'உப்பு')?.name).toBe('Salt Tata 1kg');
    expect(bestMatch(catalogue, 'பால்')?.name).toBe('Milk Aavin 500ml');
    expect(bestMatch(catalogue, 'துவரம் பருப்பு')?.name).toBe('Toor Dal 1kg');
    expect(bestMatch(catalogue, 'நல்லெண்ணெய்')?.name).toBe('Gingelly Oil 1L');
  });

  it('finds brands spoken in Tamil', () => {
    expect(bestMatch(catalogue, 'கோல்கேட்')?.name).toBe('Colgate Strong 100g');
    expect(bestMatch(catalogue, 'சர்ப்')?.name).toBe('Surf Excel 1kg');
    expect(bestMatch(catalogue, 'மேகி')?.name).toBe('Maggi Noodles');
  });

  it('finds products from Tanglish and English', () => {
    expect(bestMatch(catalogue, 'paal')?.name).toBe('Milk Aavin 500ml');
    expect(bestMatch(catalogue, 'sarkarai')?.name).toBe('Sugar 1kg');
    expect(bestMatch(catalogue, 'colgate')?.name).toBe('Colgate Strong 100g');
  });

  it('uses a spoken price to pick between similar products', () => {
    expect(bestMatch(catalogue, 'பிஸ்கட்', 10)?.name).toBe('Biscuit Parle-G');
    expect(bestMatch(catalogue, 'பிஸ்கட்', 20)?.name).toBe('Biscuit Good Day');
  });

  it('says no match rather than guess', () => {
    expect(bestMatch(catalogue, 'xyzzy')).toBeNull();
    expect(bestMatch(catalogue, 'கம்ப்யூட்டர்')).toBeNull();
    expect(bestMatch([], 'milk')).toBeNull();
  });

  it('prefers the plainer product name when scores tie', () => {
    const a = bestMatch([{ name: 'Milk Bikis' }, { name: 'Milk' }], 'milk');
    expect(a?.name).toBe('Milk');
  });
});

describe('matchScore', () => {
  it('is 1 for the same name and 0 for unrelated ones', () => {
    expect(matchScore('sugar', 'Sugar')).toBe(1);
    expect(matchScore('sugar', 'Soap')).toBe(0);
  });
});
