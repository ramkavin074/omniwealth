function FutureMilestonesAndDirectives({ assets }: { assets: any[] }) {
  const ssnAssets = assets.filter(a => a.accountCategory === 'SOCIAL_SECURITY');
  const pensionAssets = assets.filter(a => a.accountCategory === 'PENSION' || a.assetType === 'PENSION');
  const ppfAssets = assets.filter(a => a.accountCategory === 'PPF');

  // Local state overrides for direct editing without conversion interference
  const [customValues, setCustomValues] = useState<{ [key: string]: { amount: number; editing: boolean } }>({});

  if (ssnAssets.length === 0 && pensionAssets.length === 0 && ppfAssets.length === 0) {
    return null;
  }

  const getValue = (asset: any) => {
    if (customValues[asset.id] !== undefined) {
      return customValues[asset.id].amount;
    }
    return parseFloat(asset.nativeValue || '0');
  };

  const isEditing = (asset: string) => {
    return customValues[asset]?.editing || false;
  };

  const setEditing = (assetId: string, editing: boolean) => {
    setCustomValues(prev => ({
      ...prev,
      [assetId]: { amount: prev[assetId]?.amount ?? parseFloat(assets.find(a => a.id === assetId)?.nativeValue || '0'), editing }
    }));
  };

  const updateAmount = (assetId: string, amount: number) => {
    setCustomValues(prev => ({
      ...prev,
      [assetId]: { amount, editing: true }
    }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
      </div>
      
      <div className="space-y-3">
        {/* Map all Social Security entries */}
        {ssnAssets.map((asset) => (
          <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'U.S. Social Security Benefits'}</div>
              <div className="text-sm font-semibold text-white mt-1">
                Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Target Claiming Horizon: <span className="text-emerald-400 font-mono">Age 62</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Sovereign monthly pension stream tracked separately. Excluded from liquid net worth.
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Est. Monthly Payout</span>
                {isEditing(asset.id) ? (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-mono text-emerald-400 font-bold">$</span>
                    <input
                      type="number"
                      value={getValue(asset)}
                      onChange={(e) => updateAmount(asset.id, parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">/mo</span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    ${getValue(asset).toLocaleString()} / mo
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                title="Edit Amount"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Map all Pension entries (APY for you and your wife) */}
        {pensionAssets.map((asset) => (
          <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'Atal Pension Yojana (APY)'}</div>
              <div className="text-sm font-semibold text-white mt-1">
                Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Target Maturity Horizon: <span className="text-emerald-400 font-mono">Age 60</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Guaranteed monthly pension tier claimable via PRAN upon reaching age 60.
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Monthly Tier Payout</span>
                {isEditing(asset.id) ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={getValue(asset)}
                      onChange={(e) => updateAmount(asset.id, parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                    />
                    <span className="text-xs font-mono text-slate-400">{asset.nativeCurrency || 'INR'} /mo</span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {getValue(asset).toLocaleString()} {asset.nativeCurrency || 'INR'} / mo
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                title="Edit Amount"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Map all PPF entries */}
        {ppfAssets.map((asset) => (
          <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'Public Provident Fund (PPF)'}</div>
              <div className="text-sm font-semibold text-white mt-1">
                Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Maturity Target: <span className="text-amber-400 font-mono">Year 2031</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Family Claiming Instruction: Submit Form H at the designated post office or bank branch upon maturity in 2031.
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-medium">Maturity Target Value</span>
                {isEditing(asset.id) ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={getValue(asset)}
                      onChange={(e) => updateAmount(asset.id, parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                    />
                    <span className="text-xs font-mono text-slate-400">{asset.nativeCurrency || 'INR'}</span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {getValue(asset).toLocaleString()} {asset.nativeCurrency || 'INR'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                title="Edit Amount"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}