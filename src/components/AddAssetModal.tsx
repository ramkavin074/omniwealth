'use client';

import { useState, useEffect } from 'react';
import { addAssetAction } from '@/actions/assets';
import { fetchFamilyMembersAction } from '@/actions/auth';
import { PlusCircle, X } from 'lucide-react';

export default function AddAssetModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchFamilyMembersAction().then((list) => setMembers(list || []));
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const res = await addAssetAction(formData);

    if (res.success) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    } else {
      setError(res.error || 'Failed to add asset');
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Add Asset / Liability</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Add Asset / Liability to Family Vault</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Assign to Family Member</label>
                  <select
                    name="userId"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Account Category</label>
                  <select
                    name="accountCategory"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="INDIVIDUAL">Individual / Taxable</option>
                    <option value="IRA">Traditional IRA</option>
                    <option value="ROTH_IRA">Roth IRA</option>
                    <option value="401K">401(k) / Employer Plan</option>
                    <option value="HSA">Health Savings Account (HSA)</option>
                    <option value="PPF">PPF (Public Provident Fund)</option>
                    <option value="PF">PF / EPF (Employee Provident Fund)</option>
                    <option value="PENSION">Atal Pension / Pension</option>
                    <option value="SOCIAL_SECURITY">Social Security</option>
                    <option value="529">529 College Savings</option>
                    <option value="TRUST">Family Trust</option>
                    <option value="REAL_ESTATE">Real Estate Property</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Asset Name / Description</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Primary Residence or Vanguard S&P 500"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Ticker (Optional)</label>
                  <input
                    name="ticker"
                    placeholder="e.g. VOO"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Asset Class Type</label>
                  <select
                    name="assetType"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="STOCK">Stock / Equity</option>
                    <option value="CRYPTO">Cryptocurrency</option>
                    <option value="FIXED_INCOME">Fixed Income / PF / PPF</option>
                    <option value="PENSION">Pension / Social Security</option>
                    <option value="HSA">Health Savings Account (HSA)</option>
                    <option value="REAL_ESTATE">Real Estate</option>
                    <option value="CASH">Cash &amp; Bank</option>
                    <option value="LIABILITY">Liability / Mortgage / Loan</option>
                    <option value="OTHER">Other / Alternative</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
                  <select
                    name="nativeCurrency"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Valuation Amount</label>
                  <input
                    name="nativeValue"
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 25000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg cursor-pointer transition-colors disabled:opacity-50 mt-2 shadow-lg shadow-indigo-600/20"
              >
                {loading ? 'Saving to Vault...' : 'Save Asset to Family Member Vault'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}