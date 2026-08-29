import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import ProfileClient from '@/components/ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const householdId = session.householdId;
  const householdDetails = await prisma.household.findUnique({
    where: { id: householdId },
    include: { users: true },
  });

  const initialFamilyMembers = householdDetails?.users || [];

  return (
    <ProfileClient 
      session={session} 
      initialFamilyMembers={initialFamilyMembers} 
      householdDetails={householdDetails} 
    />
  );
}