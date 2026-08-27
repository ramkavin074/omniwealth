{/* Server action form for currency switcher with a save button */}
<form 
  action={async (formData) => {
    'use server';
    const curr = formData.get('currency') as string;
    if (curr) {
      await updateHouseholdBaseCurrencyAction(curr);
    }
  }}
  className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm"
>
  <Coins className="w-3.5 h-3.5 text-indigo-400" />
  <select 
    name="currency"
    defaultValue={baseCurrency}
    className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer"
  >
    {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
  <button 
    type="submit" 
    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
  >
    Save
  </button>
</form>