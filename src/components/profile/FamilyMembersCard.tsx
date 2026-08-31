'use client';

import { Users, Trash2 } from 'lucide-react';
import { deleteFamilyMemberAction } from '@/actions/vault';
import { canManageHousehold, canDeleteMember } from '@/lib/permissions';

interface FamilyMembersCardProps {
  initialFamilyMembers: any[];
  currentUserId: string;
  currentUserRole: string;
  onOpenAddModal: () => void;
}

export default function FamilyMembersCard({ initialFamilyMembers, currentUserId, currentUserRole, onOpenAddModal }: FamilyMembersCardProps) {
  const canManage = canManageHousehold(currentUserRole);

  async function handleDeleteMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this family member from the household?')) return;
    const res = await deleteFamilyMemberAction(memberId);
    if (res.success) {
      window.location.reload();
    } else {
      alert(res.error || 'Failed to remove member.');
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Family members ({initialFamilyMembers.length})</h2>
        </div>
        {canManage && (
          <button
            onClick={onOpenAddModal}
            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            Add Member
          </button>
        )}
      </div>
      <div className="space-y-3">
        {initialFamilyMembers.map((member) => (
          <div key={member.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center text-xs shadow-sm">
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">{member.fullName}</div>
              <div className="text-slate-500 dark:text-slate-400">{member.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded font-bold border ${
                member.role === 'SUPER_ADMIN' 
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900' 
                  : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-900'
              }`}>
                {member.role}
              </span>
              {member.id !== currentUserId &&
                canDeleteMember(currentUserRole, member.role) && (
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="p-1.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer transition-colors shadow-sm"
                    title="Remove Family Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}