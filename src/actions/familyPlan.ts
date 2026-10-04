'use server';

import { db } from '@/db';
import { householdContacts, householdReminders, timelineEvents } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getSessionUserAction } from '@/actions/vault';
import { canManageHousehold, canWrite, FORBIDDEN_ERROR } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/log';
import { pgCode } from '@/lib/dbErrors';
import {
  nextYear,
  sanitizeContact,
  sanitizeEvent,
  sanitizeReminder,
  type ContactInput,
} from '@/lib/familyPlan';

type Ok = { success: true };
type Fail = { success: false; error: string };

export interface ReminderRow {
  id: string;
  title: string;
  kind: string;
  dueDate: string;
  repeatYearly: boolean;
  note: string | null;
  doneAt: string | null;
}
export interface ContactRow extends ContactInput {
  id: string;
}
export interface EventRow {
  id: string;
  eventDate: string;
  label: string;
}

const NOT_SET_UP = 'This feature is not set up on the server yet.';
const failMessage = (err: unknown, where: string): Fail => {
  logError(where, err);
  return { success: false, error: pgCode(err) === '42P01' ? NOT_SET_UP : 'Could not save. Please try again.' };
};

function audit(session: any, action: string, targetType: string, targetId?: string | null) {
  return logAudit({
    actorUserId: session?.user?.id,
    actorEmail: session?.user?.email,
    householdId: session?.household?.id,
    action,
    targetType,
    targetId: targetId ?? null,
  });
}

// ---------- Reminders ----------

export async function listRemindersAction(): Promise<ReminderRow[]> {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];
    const rows = await db
      .select()
      .from(householdReminders)
      .where(eq(householdReminders.householdId, session.household.id))
      .orderBy(asc(householdReminders.dueDate));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      dueDate: r.dueDate,
      repeatYearly: r.repeatYearly,
      note: r.note,
      doneAt: r.doneAt ? r.doneAt.toISOString() : null,
    }));
  } catch {
    return []; // table not created yet
  }
}

export async function addReminderAction(input: Record<string, unknown>): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  const v = sanitizeReminder(input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const [row] = await db
      .insert(householdReminders)
      .values({ ...v.value, householdId: session.household.id, createdBy: session.user.id })
      .returning({ id: householdReminders.id });
    await audit(session, 'reminder.create', 'reminder', row.id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'addReminderAction');
  }
}

/** Mark done. A yearly reminder rolls to next year instead of closing. */
export async function completeReminderAction(id: string): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    const where = and(eq(householdReminders.id, id), eq(householdReminders.householdId, session.household.id));
    const [row] = await db.select().from(householdReminders).where(where).limit(1);
    if (!row) return { success: false, error: 'Reminder not found.' };
    if (row.repeatYearly) {
      await db.update(householdReminders).set({ dueDate: nextYear(row.dueDate) }).where(where);
    } else {
      await db.update(householdReminders).set({ doneAt: new Date() }).where(where);
    }
    await audit(session, 'reminder.complete', 'reminder', id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'completeReminderAction');
  }
}

export async function deleteReminderAction(id: string): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    await db
      .delete(householdReminders)
      .where(and(eq(householdReminders.id, id), eq(householdReminders.householdId, session.household.id)));
    await audit(session, 'reminder.delete', 'reminder', id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'deleteReminderAction');
  }
}

// ---------- Contacts ----------

export async function listContactsAction(): Promise<ContactRow[]> {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];
    const rows = await db
      .select()
      .from(householdContacts)
      .where(eq(householdContacts.householdId, session.household.id))
      .orderBy(asc(householdContacts.createdAt));
    return rows
      .map((r) => ({ id: r.id, name: r.name, role: r.role, phone: r.phone, email: r.email, note: r.note, isLegacy: r.isLegacy }))
      .sort((a, b) => Number(b.isLegacy) - Number(a.isLegacy));
  } catch {
    return [];
  }
}

export async function addContactAction(input: Record<string, unknown>): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  const v = sanitizeContact(input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const [row] = await db
      .insert(householdContacts)
      .values({ ...v.value, householdId: session.household.id, createdBy: session.user.id })
      .returning({ id: householdContacts.id });
    await audit(session, 'contact.create', 'contact', row.id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'addContactAction');
  }
}

export async function deleteContactAction(id: string): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    await db
      .delete(householdContacts)
      .where(and(eq(householdContacts.id, id), eq(householdContacts.householdId, session.household.id)));
    await audit(session, 'contact.delete', 'contact', id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'deleteContactAction');
  }
}

// ---------- Timeline events ----------

export async function listEventsAction(): Promise<EventRow[]> {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];
    const rows = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.householdId, session.household.id))
      .orderBy(asc(timelineEvents.eventDate));
    return rows.map((r) => ({ id: r.id, eventDate: r.eventDate, label: r.label }));
  } catch {
    return [];
  }
}

export async function addEventAction(input: { label?: string; eventDate?: string }): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  const v = sanitizeEvent(input as Record<string, unknown>);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const [row] = await db
      .insert(timelineEvents)
      .values({ ...v.value, householdId: session.household.id, createdBy: session.user.id })
      .returning({ id: timelineEvents.id });
    await audit(session, 'timeline_event.create', 'timeline_event', row.id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'addEventAction');
  }
}

export async function deleteEventAction(id: string): Promise<Ok | Fail> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    await db
      .delete(timelineEvents)
      .where(and(eq(timelineEvents.id, id), eq(timelineEvents.householdId, session.household.id)));
    await audit(session, 'timeline_event.delete', 'timeline_event', id);
    revalidatePath('/');
    return { success: true };
  } catch (err) {
    return failMessage(err, 'deleteEventAction');
  }
}
