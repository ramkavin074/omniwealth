// Catalogue + stock export. Same column names the importer accepts, so an
// export can be edited and re-imported. Plus a `stock_value` column for the
// owner's report.

import type { AccountantExport } from './db/accountant';
import type { Product } from './types';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number)[]) => cells.map(csvCell).join(',');

export function buildCatalogueCsv(products: Product[]): string {
  const header = [
    'barcode',
    'name',
    'mrp',
    'price',
    'cost',
    'unit',
    'stock',
    'low_stock_threshold',
    'expiry',
    'gst',
    'hsn',
    'stock_value',
    'stock_cost',
  ];
  const lines = [header.join(',')];
  for (const p of products) {
    lines.push(
      [
        p.barcode ?? '',
        p.name,
        p.mrp,
        p.price,
        p.costPrice || '',
        p.unit,
        p.stockQty,
        p.lowStockThreshold,
        p.expiryDate ?? '',
        p.gstRate || '',
        p.hsn ?? '',
        Math.round(p.price * p.stockQty * 100) / 100,
        p.costPrice ? Math.round(p.costPrice * p.stockQty * 100) / 100 : '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/** Trigger a browser download. Reliable in a desktop browser (the owner can
 *  export from the in-OmniWealth /stocking page). On the Android WebView a
 *  blob download may need the Filesystem plugin — revisit if a shop needs
 *  on-device export. */
export function downloadFile(
  filename: string,
  text: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Back-compat alias. */
export const downloadCsv = (filename: string, text: string) =>
  downloadFile(filename, text);

// ---- accountant / CA hand-off (C6) ----

const money = (n: number) => Math.round(n * 100) / 100;

/** One workbook-style CSV: `# SECTION` banners separate the registers so a CA
 *  can split it into sheets. Opens straight into Excel / Google Sheets. */
export function buildAccountantCsv(x: AccountantExport): string {
  const L: string[] = [];
  const gen = new Date(x.generatedAt).toLocaleString('en-IN');
  L.push(`# OmniWealth Kadai — accountant export`);
  L.push(`# Period,${x.range.label}`);
  L.push(`# Generated,${gen}`);
  if (x.store.gstin) L.push(`# GSTIN,${x.store.gstin}`);
  L.push('');

  L.push('# SUMMARY');
  const s = x.summary;
  L.push(row(['Turnover (net of refunds)', money(s.turnover)]));
  L.push(row(['  Cash', money(s.cash)]));
  L.push(row(['  Digital (UPI + card)', money(s.digital)]));
  L.push(row(['  On account (credit)', money(s.credit)]));
  L.push(row(['Refunds', money(s.refunds)]));
  if (s.roundoff) L.push(row(['Rounding adjustment', money(s.roundoff)]));
  L.push(row(['Purchases (invoice value)', money(s.purchaseTotal)]));
  L.push(row(['Expenses', money(s.expenseTotal)]));
  if (x.store.gstEnabled) {
    L.push(row(['GST output (on sales)', money(s.gstOutputTotal)]));
    L.push(row(['GST input credit (purchases + expenses)', money(s.gstInputTotal)]));
    L.push(row(['Net GST payable', money(s.netGstPayable)]));
  }
  L.push(row(['Gross profit (approx: turnover − COGS − expenses)', money(s.grossProfitApprox)]));
  L.push(row(['Receivables outstanding (as of today)', money(s.receivablesNow)]));
  L.push(row(['Payables outstanding (as of today)', money(s.payablesNow)]));
  L.push('');

  if (x.store.gstEnabled && s.gstOutputByRate.length) {
    L.push('# GST OUTPUT BY RATE');
    L.push(row(['Rate %', 'Taxable', 'CGST', 'SGST']));
    for (const r of s.gstOutputByRate)
      L.push(row([r.rate, money(r.taxable), money(r.cgst), money(r.sgst)]));
    L.push('');
  }

  L.push('# SALES REGISTER');
  L.push(row(['Date', 'Bill no', 'Party', 'Type', 'Taxable', 'CGST', 'SGST', 'Total', 'Tender']));
  for (const r of x.sales)
    L.push(
      row([
        r.date,
        r.billNo,
        r.party,
        r.isRefund ? 'REFUND' : 'SALE',
        money(r.taxable),
        money(r.cgst),
        money(r.sgst),
        money(r.total),
        r.tender,
      ]),
    );
  L.push('');

  L.push('# PURCHASE REGISTER');
  L.push(row(['Date', 'Invoice no', 'Supplier', 'Taxable', 'GST input', 'Total', 'Paid']));
  for (const r of x.purchases)
    L.push(
      row([r.date, r.invoiceNo, r.party, money(r.taxable), money(r.gstInput), money(r.total), money(r.paid)]),
    );
  L.push('');

  L.push('# EXPENSE REGISTER');
  L.push(row(['Date', 'Category', 'Paid to', 'Amount', 'GST input', 'Tender']));
  for (const r of x.expenses)
    L.push(row([r.date, r.category, r.payee, money(r.amount), money(r.gstInput), r.tender]));
  L.push('');

  L.push('# RECEIPTS FROM CUSTOMERS (khata collections)');
  L.push(row(['Date', 'Customer', 'Amount', 'Tender']));
  for (const r of x.receipts)
    L.push(row([r.date, r.customer, money(r.amount), r.tender]));
  L.push('');

  L.push('# PAYMENTS TO SUPPLIERS');
  L.push(row(['Date', 'Supplier', 'Amount']));
  for (const r of x.payments) L.push(row([r.date, r.supplier, money(r.amount)]));
  L.push('');

  L.push('# ITEM-WISE SALES PROFIT');
  L.push(row(['Code', 'Item', 'MRP', 'Qty sold', 'Sale value', 'Cost value', 'Profit', 'Profit %']));
  for (const r of x.itemProfit)
    L.push(
      row([
        r.code,
        r.name,
        money(r.mrp),
        r.qty,
        money(r.saleValue),
        money(r.costValue),
        money(r.profit),
        r.pct,
      ]),
    );
  const ipT = x.itemProfit.reduce(
    (a, r) => ({
      s: a.s + r.saleValue,
      c: a.c + r.costValue,
      p: a.p + r.profit,
    }),
    { s: 0, c: 0, p: 0 },
  );
  L.push(row(['', 'TOTAL', '', '', money(ipT.s), money(ipT.c), money(ipT.p), '']));
  L.push('');

  L.push('# PROFIT & LOSS');
  const p = x.summary.pnl;
  L.push(row(['Gross sales', money(p.grossSales)]));
  L.push(row(['Less: returns', money(p.returns)]));
  L.push(row(['Net sales', money(p.netSales)]));
  L.push(row(['Less: cost of goods sold', money(p.cogs)]));
  L.push(row(['Gross profit', money(p.grossProfit)]));
  L.push(row(['Less: expenses', money(p.expenseTotal)]));
  for (const c of x.summary.expenseByCategory)
    L.push(row([`  ${c.category}`, money(c.amount)]));
  L.push(row(['Net profit', money(p.netProfit)]));
  L.push('');

  return L.join('\n') + '\n';
}

// --- Tally XML ---

const xmlEsc = (v: string | number) =>
  String(v).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );

/** Tally date is DD-Mmm-YYYY (e.g. 05-Sep-2026). */
const tallyDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  const mmm = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    Number(m) - 1
  ];
  return `${d}-${mmm}-${y}`;
};

function ledgerEntry(name: string, amount: number, isDebit: boolean): string {
  // Tally convention: a debit amount is negative in the XML.
  const amt = isDebit ? -Math.abs(amount) : Math.abs(amount);
  return (
    `      <ALLLEDGERENTRIES.LIST>\n` +
    `        <LEDGERNAME>${xmlEsc(name)}</LEDGERNAME>\n` +
    `        <ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>\n` +
    `        <AMOUNT>${amt}</AMOUNT>\n` +
    `      </ALLLEDGERENTRIES.LIST>\n`
  );
}

function voucher(
  type: string,
  date: string,
  narration: string,
  entries: string,
): string {
  return (
    `    <VOUCHER VCHTYPE="${type}" ACTION="Create">\n` +
    `      <DATE>${tallyDate(date)}</DATE>\n` +
    `      <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>\n` +
    `      <NARRATION>${xmlEsc(narration)}</NARRATION>\n` +
    entries +
    `    </VOUCHER>\n`
  );
}

/** A minimal Tally import: Sales, Purchase, Receipt and Payment vouchers with
 *  party + tax ledgers. Import under Gateway of Tally → Import Data → Vouchers.
 *  The CA should map / rename ledgers to their chart of accounts. */
export function buildTallyXml(x: AccountantExport): string {
  let body = '';

  for (const r of x.sales) {
    const gross = r.total;
    const partyLed = r.party === 'Counter' ? 'Cash' : r.party;
    let e = ledgerEntry(partyLed, gross, true); // party/cash debited
    e += ledgerEntry('Sales', r.taxable || gross - r.cgst - r.sgst, false);
    if (r.cgst) e += ledgerEntry('Output CGST', r.cgst, false);
    if (r.sgst) e += ledgerEntry('Output SGST', r.sgst, false);
    body += voucher(
      r.isRefund ? 'Credit Note' : 'Sales',
      r.date,
      `${r.isRefund ? 'Refund ' : ''}${r.billNo} — ${r.party} (${r.tender})`,
      e,
    );
  }

  for (const r of x.purchases) {
    let e = ledgerEntry('Purchase', r.taxable, true);
    if (r.gstInput) {
      e += ledgerEntry('Input CGST', r.gstInput / 2, true);
      e += ledgerEntry('Input SGST', r.gstInput / 2, true);
    }
    e += ledgerEntry(r.party, r.total, false); // supplier credited
    body += voucher('Purchase', r.date, `${r.invoiceNo} — ${r.party}`, e);
  }

  for (const r of x.receipts) {
    let e = ledgerEntry('Cash', r.amount, true);
    e += ledgerEntry(r.customer, r.amount, false);
    body += voucher('Receipt', r.date, `Receipt — ${r.customer} (${r.tender})`, e);
  }

  for (const r of x.payments) {
    let e = ledgerEntry(r.supplier, r.amount, true);
    e += ledgerEntry('Cash', r.amount, false);
    body += voucher('Payment', r.date, `Payment — ${r.supplier}`, e);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ENVELOPE>\n` +
    `  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n` +
    `  <BODY><IMPORTDATA>\n` +
    `    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>\n` +
    `    <REQUESTDATA>\n` +
    body +
    `    </REQUESTDATA>\n` +
    `  </IMPORTDATA></BODY>\n` +
    `</ENVELOPE>\n`
  );
}
