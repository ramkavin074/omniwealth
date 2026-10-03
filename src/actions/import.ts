'use server';

import { db } from '@/db';
import { assets, portfolios, transactions, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSessionUserAction, fetchLiveExchangeRatesAction } from '@/actions/vault';
import { canWrite, canManageHousehold, READ_ONLY_ERROR } from '@/lib/permissions';
import { toNumeric } from '@/lib/num';
import { logError } from '@/lib/log';
import { logAudit } from '@/lib/audit';
import { dupKey, normalizeRaw, MAX_IMPORT_ROWS, type RawRow } from '@/lib/assetCsv';

export type ImportResult =
  | { success: true; imported: number; skipped: number }
  | { success: false; error: string };

/**
 * Bulk-add holdings from a reviewed CSV. The browser previews with the same
 * normalizeRaw() rules; every row is re-validated here and nothing from the
 * client is trusted. All-or-nothing: either every valid row lands or none.
 */
export async function importAssetsCsvAction(rawRows: RawRow[], skipDuplicates: boolean): Promise<ImportResult> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { success: false, error: 'Nothing to import.' };
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return { success: false, error: `Too many rows (max ${MAX_IMPORT_ROWS} per import).` };
  }

  try {
    const householdId = session.household.id;
    const baseCurrency = session.household.baseCurrency || 'USD';

    // Revalidate every row server-side.
    const field = (v: unknown) => (typeof v === 'string' ? v : '');
    const cleaned = rawRows
      .map((r) =>
        normalizeRaw(
          {
            name: field(r?.name),
            type: field(r?.type),
            category: field(r?.category),
            accountNumber: field(r?.accountNumber),
            currency: field(r?.currency),
            value: field(r?.value),
            quantity: field(r?.quantity),
            ticker: field(r?.ticker),
            pillar: field(r?.pillar),
            owner: field(r?.owner),
          },
          baseCurrency,
        ).clean,
      )
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // Duplicates against what's already in the household (and within the file).
    const existing = await db.select().from(assets).where(eq(assets.householdId, householdId));
    const seen = new Set(existing.map((a) => dupKey(a.name, a.accountNumber, a.nativeCurrency)));
    const toInsert = cleaned.filter((c) => {
      const key = dupKey(c.name, c.accountNumber, c.currency);
      if (skipDuplicates && seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = rawRows.length - toInsert.length;
    if (toInsert.length === 0) {
      return { success: false, error: 'No valid rows to import.' };
    }

    // Owners: admins can assign by member name (as in the export); everyone
    // else imports into their own portfolio.
    const members = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.householdId, householdId));
    const canAssign = canManageHousehold(session.user.role);
    const memberByName = new Map(
      members.map((m) => [(m.fullName || '').trim().toLowerCase(), m.id]),
    );
    const ownerFor = (name: string): string => {
      if (!canAssign || !name) return session.user.id;
      return memberByName.get(name.trim().toLowerCase()) ?? session.user.id;
    };

    const rates = await fetchLiveExchangeRatesAction();
    const fxToBase = (cur: string) => {
      if (cur === baseCurrency) return 1;
      return (rates[baseCurrency] || 1) / (rates[cur] || 1);
    };

    await db.transaction(async (tx) => {
      const portfolioByUser = new Map<string, string>();
      for (const uid of new Set(toInsert.map((c) => ownerFor(c.owner)))) {
        let [p] = await tx.select().from(portfolios).where(eq(portfolios.userId, uid));
        if (!p) {
          [p] = await tx
            .insert(portfolios)
            .values({ householdId, userId: uid, name: 'Portfolio', isHouseholdVisible: true })
            .returning();
        }
        portfolioByUser.set(uid, p.id);
      }

      const inserted = await tx
        .insert(assets)
        .values(
          toInsert.map((c) => {
            const uid = ownerFor(c.owner);
            return {
              householdId,
              userId: uid,
              portfolioId: portfolioByUser.get(uid)!,
              name: c.name,
              ticker: c.ticker,
              assetType: c.assetType,
              accountCategory: c.accountCategory,
              accountNumber: c.accountNumber,
              rationale: c.pillar,
              nativeCurrency: c.currency,
              quantity: toNumeric(c.quantity ?? 1, '1'),
              nativeValue: toNumeric(c.value, '0'),
            };
          }),
        )
        .returning({ id: assets.id });

      await tx.insert(transactions).values(
        inserted.map((row, i) => {
          const c = toInsert[i];
          const qty = c.quantity ?? 1;
          return {
            assetId: row.id,
            type: 'MANUAL_ADD',
            quantity: toNumeric(qty, '1'),
            nativePrice: toNumeric(c.value / qty, '0'),
            nativeCurrency: c.currency,
            fxRateToBaseOnDate: fxToBase(c.currency).toFixed(6),
            transactionDate: new Date(),
          };
        }),
      );
    });

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      householdId,
      action: 'asset.import',
      targetType: 'asset',
      meta: { imported: toInsert.length, skipped },
    });

    revalidatePath('/');
    return { success: true, imported: toInsert.length, skipped };
  } catch (err) {
    logError('importAssetsCsvAction', err);
    return { success: false, error: 'The import failed and nothing was added. Please try again.' };
  }
}
