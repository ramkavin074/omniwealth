import Link from 'next/link';

// A thin bar at the top of each product page so visitors can get back to the all-apps home page.
export default function AllAppsBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? 'bg-slate-900 text-slate-300' : 'bg-slate-900 text-slate-200'}>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-2 text-xs font-medium">
        <Link href="/" className="hover:text-white">&larr; OmniWealth: all our apps</Link>
        <span className="hidden gap-4 sm:flex">
          <Link href="/wealth" className="hover:text-white">OmniWealth</Link>
          <Link href="/kadai" className="hover:text-white">Kadai</Link>
          <Link href="/omnikalvi" className="hover:text-white">OmniKalvi</Link>
        </span>
      </div>
    </div>
  );
}
