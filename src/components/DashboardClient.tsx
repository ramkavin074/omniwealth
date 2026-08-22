{/* Responsive Unified Header for Laptops & Mobile */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          
          {/* Left Side: Brand & Navigation */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                🌐
              </div>
              <div>
                <div className="font-extrabold text-white text-xs tracking-tight">
                  {session.household.name.replace(/ Vault$/i, '')} Vault
                </div>
                <div className="text-[10px] text-slate-400">Wealth Command</div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-6">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-indigo-300 rounded-lg text-xs font-semibold shadow-sm">
                <Home className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Family
              </Link>
              {session.user.role === 'SUPER_ADMIN' && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-medium transition-colors border border-amber-500/20">
                  <Shield className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Right Side: Clean Single-Row Action Bar for Laptops */}
          <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <CurrencySwitcherForm currentCurrency={baseCurrency} />

            <button 
              onClick={async () => {
                setIsSyncing(true);
                await refreshLiveMarketPricesAction();
                setIsSyncing(false);
                window.location.reload();
              }} 
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md disabled:opacity-50 shrink-0"
              title="Fetch live market prices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Prices'}</span>
            </button>

            <button onClick={() => setIsAddAssetOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md shrink-0">
              <Plus className="w-4 h-4" /><span>Add Asset</span>
            </button>

            <button onClick={() => setIsAiReaderOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /><span>AI Reader</span>
            </button>

            <form action={async () => { window.location.href = '/login'; }} className="shrink-0">
              <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-colors cursor-pointer text-xs font-semibold shadow-sm" title="Log Out">
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>

        </div>
      </header>