'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDraftLineItemsAction } from '@/actions/aiStatement';
import { ShieldAlert, Users, Database, FileCode, CheckCircle } from 'lucide-react';

export default function AdminDashboardClient() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true);
      try {
        const items = await fetchDraftLineItemsAction();
        setDrafts(items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <header className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              <span>Super Admin Portal</span>
            </h1>
            <p className="text-xs text-slate-400">
              <span>System Governance &bull; Gemini AI &bull; Encrypted Vault</span>
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-slate-300 hover:text-white"
        >
          <span>Back to Family Dashboard</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">System Status</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            <span>Operational</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            <span>Serverless Database Active</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">AI Statement Model</span>
            <FileCode className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-400 mt-2">
            <span>Gemini 2.5 Flash</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            <span>Structured JSON Schema Mode</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Pending AI Line Items</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{drafts.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            <span>Staged for Household Approval</span>
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-indigo-400" />
          <span>Stage Queue (AI Statement Inspector)</span>
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500">
            <span>Loading stage logs...</span>
          </p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-slate-500">
            <span>No pending line items in queue.</span>
          </p>
        ) : (
          <div className="space-y-2">
            {drafts.map((item) => (
              <div key={item.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs flex justify-between items-center font-mono">
                <div>
                  <span className="text-white font-semibold">{item.assetName}</span>
                  {item.ticker && <span className="text-slate-500 ml-2">({item.ticker})</span>}
                </div>
                <div className="text-slate-400">
                  {item.quantity} x {item.pricePerUnit} {item.nativeCurrency}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
