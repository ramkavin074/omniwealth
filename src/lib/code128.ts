// Code 128 (set B) barcode encoder, pure. Used to print shelf / price labels.
// Set B covers the printable ASCII range, which holds EAN/UPC digits and any
// shop-made code, and every retail scanner reads it.

// Bar/space widths for symbol values 0..106 (start B = 104, stop = 106).
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

const START_B = 104;
const STOP = 106;

/** True when every character can be written in set B (printable ASCII). */
export function canEncode128(text: string): boolean {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

/** Module string for `text`: '1' = bar, '0' = space (quiet zones not included). */
export function code128Modules(text: string): string {
  if (!canEncode128(text)) throw new Error('Not encodable as Code 128 set B');
  const values = [START_B];
  for (let i = 0; i < text.length; i++) values.push(text.charCodeAt(i) - 32);
  let sum = START_B;
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, STOP);

  let out = '';
  for (const v of values) {
    let bar = true;
    for (const w of PATTERNS[v]) {
      out += (bar ? '1' : '0').repeat(Number(w));
      bar = !bar;
    }
  }
  return out;
}

/** Inline SVG of the bars with the 10-module quiet zone scanners need on each side
 *  (scales to its container width). */
export function code128Svg(text: string, heightPx = 40): string {
  const m = code128Modules(text);
  let rects = '';
  let i = 0;
  while (i < m.length) {
    if (m[i] === '1') {
      let j = i;
      while (j < m.length && m[j] === '1') j++;
      rects += `<rect x="${i}" y="0" width="${j - i}" height="${heightPx}"/>`;
      i = j;
    } else i++;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 0 ${m.length + 20} ${heightPx}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}
