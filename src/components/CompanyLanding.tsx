import Image from 'next/image';
import Link from 'next/link';

// The home page for visitors: one landing page for all the apps. Keep every claim true of the shipped apps.
// Change PARENT_NAME to rename the maker line; each product keeps its own page (/wealth, /kadai, /omnikalvi).
const PARENT_NAME = 'DreamBee Network';
const CONTACT_EMAIL = 'admin@omniwealth.org';
const CONTACT = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Hello from the website')}`;

type App = {
  name: string;
  icon: string;
  line: string;
  body: string;
  points: string[];
  status: string;
  more: string;
  open?: { href: string; label: string };
  test?: string; // Google Play closed-testing join link
};

const APPS: App[] = [
  {
    name: 'OmniWealth',
    icon: '/icon-192.png',
    line: 'Your family\'s wealth, in one private place.',
    body: 'See bank accounts, investments, property and other assets together, in your own currency, with a secure vault for the papers that matter.',
    points: ['Net worth across currencies', 'Encrypted document vault', 'Retirement what-ifs'],
    status: 'On the web, Android and iPhone',
    more: '/wealth',
    open: { href: '/login', label: 'Sign in' },
  },
  {
    name: 'Kadai',
    icon: '/kadai-icon-192.png',
    line: 'Bill, stock and UPI for your shop, in Tamil or English.',
    body: 'For grocery, provision, medical and general stores: fast billing, expiry-aware stock, credit accounts and UPI checking. Keeps working without internet.',
    points: ['Voice billing in Tamil', 'Sell the oldest stock first', 'Works offline'],
    status: 'Android in closed testing, iPhone coming soon',
    more: '/kadai',
    test: 'https://play.google.com/apps/testing/com.omniwealth.kadai',
  },
  {
    name: 'OmniKalvi',
    icon: '/omnikalvi-icon-192.png',
    line: 'Every school, in one app.',
    body: 'Attendance, homework, notices, fees, bus and a canteen with allergy checks, on the phones teachers and parents already have. In English and Tamil.',
    points: ['Attendance in seconds', 'Notices parents confirm', 'Cashless canteen'],
    status: 'Android in closed testing, iPhone coming soon',
    more: '/omnikalvi',
    test: 'https://play.google.com/apps/testing/com.omniwealth.schoolos',
  },
];

export default function CompanyLanding() {
  return (
    <main className="bg-white text-slate-700">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold text-slate-900">{PARENT_NAME}</span>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
          <a href="#apps" className="hover:text-teal-700">Our apps</a>
          <a href="#about" className="hidden hover:text-teal-700 sm:inline">About</a>
          <a href={CONTACT} className="rounded-lg bg-teal-700 px-3.5 py-2 text-white hover:bg-teal-600">Contact</a>
        </nav>
      </header>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-5 py-16 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">Simple apps for everyday life</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            One app for your money. One for your shop. One for your school.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-300">
            We build focused apps, each around one job and made to work on ordinary phones. Choose the one that fits, or all three.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#apps" className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500">See our apps</a>
            <a href={CONTACT} className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400">Get in touch</a>
          </div>
        </div>
      </section>

      <section id="apps" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-16">
        <h2 className="text-2xl font-extrabold text-slate-900">Our apps</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {APPS.map((a) => (
            <article key={a.name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Image src={a.icon} alt="" width={48} height={48} className="rounded-xl" />
                <h3 className="text-xl font-extrabold text-slate-900">{a.name}</h3>
              </div>
              <p className="mt-4 font-semibold text-slate-900">{a.line}</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-600">{a.body}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-teal-700">✓</span>{p}</li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">{a.status}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={a.more} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-600">Learn more</Link>
                {a.test && (
                  <a href={`${a.more}#early`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                    Early access
                  </a>
                )}
                {a.open && (
                  <Link href={a.open.href} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
                    {a.open.label}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="scroll-mt-6 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-2xl font-extrabold text-slate-900">About</h2>
          <p className="mt-4 text-[15px] leading-7 text-slate-600">
            {PARENT_NAME} makes small, focused apps: one for families and their money, one for shops, and one for schools.
            Each is built around a single job, keeps its screens simple, and respects your privacy. Kadai and OmniKalvi work in Tamil and English.
          </p>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Questions, a live demo of Kadai or OmniKalvi, or early access to the Android tests? Write to us.
          </p>
          <a href={CONTACT} className="mt-5 inline-block rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-600">
            Email {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs">
          <span>{PARENT_NAME}. OmniWealth, Kadai and OmniKalvi.</span>
          <span className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/help" className="hover:text-white">Help</Link>
            <Link href="/delete-account" className="hover:text-white">Delete your data</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
