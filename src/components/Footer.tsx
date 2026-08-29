import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-20 pt-8 border-t border-slate-200 text-slate-500 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-center md:text-left space-y-1">
        <div>&copy; 2026 OmniWealth Private Office. All rights reserved.</div>
        <div className="text-xs text-slate-500 max-w-xl">
          Disclaimer: OmniWealth is a global multi-generational family asset command platform for informational tracking purposes only.
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 font-medium text-slate-600">
        <Link href="/" className="hover:text-slate-900 transition-colors">Dashboard</Link>
        <span>•</span>
        <Link href="/vault" className="hover:text-slate-900 transition-colors">Vault</Link>
        <span>•</span>
        <Link href="/profile" className="hover:text-slate-900 transition-colors">Settings</Link>
      </div>
    </footer>
  );
}