// Minimal PDF writer: one full-page JPEG per page. Enough to hand a printable
// document to the phone's share / print sheet without a PDF library.

export interface PdfPage {
  widthPt: number; // page size in points (1/72 inch)
  heightPt: number;
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
}

const enc = new TextEncoder();

export function buildPdf(pages: PdfPage[]): Uint8Array {
  if (pages.length === 0) throw new Error('No pages');
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array) => {
    parts.push(b);
    length += b.length;
  };
  const text = (s: string) => push(enc.encode(s));
  const startObj = (n: number) => {
    offsets[n] = length;
    text(`${n} 0 obj\n`);
  };

  // Object numbers: 1 catalog, 2 pages, then per page: page, content, image.
  text('%PDF-1.4\n');
  startObj(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  text(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageN = 3 + i * 3;
    const contentN = pageN + 1;
    const imageN = pageN + 2;
    const w = p.widthPt.toFixed(2);
    const h = p.heightPt.toFixed(2);
    startObj(pageN);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageN} 0 R >> >> /Contents ${contentN} 0 R >>\nendobj\n`,
    );
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    startObj(contentN);
    text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObj(imageN);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    push(p.jpeg);
    text('\nendstream\nendobj\n');
  });

  const count = 3 + pages.length * 3;
  const xrefAt = length;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) {
    text(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const b of parts) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
