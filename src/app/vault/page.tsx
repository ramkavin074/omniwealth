import { fetchHouseholdDocumentsAction, getSessionUserAction } from '@/actions/vault';
import VaultPageClient from '@/components/VaultPageClient';
import { redirect } from 'next/navigation';

export default async function VaultPageRoute() {
  const session = await getSessionUserAction();
  if (!session) {
    redirect('/');
  }

  const documents = await fetchHouseholdDocumentsAction();
  
  // Prevent duplicate "Vault Vault" if the household name already includes "Vault"
  const rawHouseholdName = session?.household?.name || 'Private Family';
  const householdTitle = rawHouseholdName.toLowerCase().endsWith('vault')
    ? rawHouseholdName
    : `${rawHouseholdName} Vault`;

  return (
    <VaultPageClient 
      initialDocuments={documents} 
      householdTitle={householdTitle} 
    />
  );
}