'use server';

import { db } from '@/db';
import { retirementScenarios } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSessionUserAction } from '@/actions/vault';
import { canWrite, FORBIDDEN_ERROR } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/log';
import { pgCode } from '@/lib/dbErrors';
import { MAX_SCENARIOS, sanitizeScenario, type ScenarioConfig } from '@/lib/scenarioConfig';

export interface SavedScenario {
  id: string;
  name: string;
  config: ScenarioConfig;
}

type Ok = { success: true };
type Fail = { success: false; error: string };

export async function listScenariosAction(): Promise<SavedScenario[]> {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];
    const rows = await db
      .select()
      .from(retirementScenarios)
      .where(eq(retirementScenarios.householdId, session.household.id))
      .orderBy(asc(retirementScenarios.createdAt));
    const out: SavedScenario[] = [];
    for (const r of rows) {
      try {
        // Re-sanitise on read so a hand-edited row can never feed the engine bad numbers.
        const v = sanitizeScenario({ name: r.name, config: JSON.parse(r.config) });
        if (v.ok) out.push({ id: r.id, name: v.value.name, config: v.value.config });
      } catch {
        /* skip unreadable row */
      }
    }
    return out;
  } catch {
    return []; // table not created yet
  }
}

export async function saveScenarioAction(input: Record<string, unknown>): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  const v = sanitizeScenario(input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const existing = await db
      .select({ id: retirementScenarios.id })
      .from(retirementScenarios)
      .where(eq(retirementScenarios.householdId, session.household.id));
    if (existing.length >= MAX_SCENARIOS) {
      return { success: false, error: `You can keep up to ${MAX_SCENARIOS} scenarios. Delete one first.` };
    }
    const [row] = await db
      .insert(retirementScenarios)
      .values({
        householdId: session.household.id,
        name: v.value.name,
        config: JSON.stringify(v.value.config),
        createdBy: session.user.id,
      })
      .returning({ id: retirementScenarios.id });
    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      householdId: session.household.id,
      action: 'scenario.create',
      targetType: 'scenario',
      targetId: row.id,
    });
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    logError('saveScenarioAction', err);
    return {
      success: false,
      error: pgCode(err) === '42P01' ? 'Saving scenarios is not set up on the server yet.' : 'Could not save. Please try again.',
    };
  }
}

export async function deleteScenarioAction(id: string): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    await db
      .delete(retirementScenarios)
      .where(and(eq(retirementScenarios.id, id), eq(retirementScenarios.householdId, session.household.id)));
    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      householdId: session.household.id,
      action: 'scenario.delete',
      targetType: 'scenario',
      targetId: id,
    });
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    logError('deleteScenarioAction', err);
    return { success: false, error: 'Could not delete. Please try again.' };
  }
}
