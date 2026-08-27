function GrowthSimulator({ currentTotalValue, baseCurrency }: { currentTotalValue: number; baseCurrency: string }) {
  const [returnRate, setReturnRate] = useState(7);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [years, zSetYears] = useState(10);
  const [monthly, setMonthly] = useState(500);

  // Monthly nominal return rate compounding
  const r = returnRate / 100 / 12;
  const n = years * 12;
  
  // Nominal Future Value calculation
  const nominalFV = Math.round(
    currentTotalValue * Math.pow(1 + r, n) + 
    (r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n)
  );

  // Inflation-Adjusted Real Purchasing Power calculation
  const annualInflation = inflationRate / 100;
  const realFV = Math.round(nominalFV / Math.pow(1 + annualInflation, years));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Calculator className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Future Wealth &amp; Inflation-Adjusted Simulation</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Expected Return ({returnRate}%)</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            step="0.5" 
            value={returnRate} 
            onChange={(e) => setReturnRate(parseFloat(e.target.value))} 
            className="w-full accent-indigo-500 cursor-pointer" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Inflation Rate ({inflationRate}%)</label>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.25" 
            value={inflationRate} 
            onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
            className="w-full accent-rose-500 cursor-pointer" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Time Horizon ({years} Yrs)</label>
          <input 
            type="range" 
            min="1" 
            max="40" 
            value={years} 
            onChange={(e) => zSetYears(parseInt(e.target.value))} 
            className="w-full accent-indigo-500 cursor-pointer" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Monthly Addition</label>
          <input 
            type="number" 
            value={monthly} 
            onChange={(e) => setMonthly(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-medium">Nominal Projected Value</span>
          <div className="text-xl font-extrabold font-mono text-emerald-400 mt-1">
            {nominalFV.toLocaleString()} <span className="text-xs text-indigo-400">{baseCurrency}</span>
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-medium">Inflation-Adjusted (Real Purchasing Power)</span>
          <div className="text-xl font-extrabold font-mono text-indigo-400 mt-1">
            {realFV.toLocaleString()} <span className="text-xs text-indigo-400">{baseCurrency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}