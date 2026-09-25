import Link from 'next/link';
import Image from 'next/image';
import {
  Wallet,
  Lock,
  Sparkles,
  Target,
  Users,
  ShieldCheck,
  ArrowRight,
  Apple,
  Check,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Wallet,
    title: 'Multi-currency dashboard',
    description:
      'See every bank account, investment, property, and other asset in one net-worth view — automatically converted to your household currency.',
  },
  {
    icon: Lock,
    title: 'Secure document vault',
    description:
      'AES-256-GCM encrypted storage for wills, deeds, and statements — the paperwork that matters, kept safe and always within reach.',
  },
  {
    icon: Sparkles,
    title: 'Ask Wealth AI',
    description:
      "A built-in assistant that answers questions about your own household's portfolio — no spreadsheets, no digging.",
  },
  {
    icon: Target,
    title: 'Retirement planning',
    description:
      'Project your retirement timeline against real inflation and return assumptions, tailored to your own numbers.',
  },
  {
    icon: Users,
    title: 'Built for families',
    description:
      'Invite family members with role-based access — see the whole picture together, or keep parts of it private.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    description:
      'Face ID app lock, encrypted data at rest, and no ads or data sharing. Informational only — we never move money or connect to your accounts.',
  },
];

const STEPS = [
  'Create your household in under a minute',
  'Add your accounts, holdings, and property',
  'See your true net worth — instantly, in any currency',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-600 selection:text-white">
      {/* Nav */}
      <header className="border-b border-slate-800/80">
        <div
          className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 pb-4"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-800 shrink-0">
              <Image src="/omniwealth.jpg" alt="OmniWealth" width={36} height={36} className="object-cover w-full h-full" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">OmniWealth</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/help" className="text-slate-400 hover:text-white transition-colors hidden sm:inline">
              Help
            </Link>
            <Link href="/login" className="text-slate-300 hover:text-white transition-colors hidden sm:inline">
              Sign In
            </Link>
            <Link
              href="/login?tab=register"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
          One private dashboard for your
          <br />
          <span className="text-teal-400">family&rsquo;s entire net worth</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
          Bank accounts, investments, property, and more — tracked in real time, across every
          currency, in one place only your family can see. No spreadsheets, no guessing.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login?tab=register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-teal-900/30"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold rounded-xl transition-colors"
          >
            See How It Works
          </Link>
        </div>
        <a
          href="https://apps.apple.com/app/id6810544681"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2.5 px-5 py-2.5 bg-black hover:bg-slate-900 border border-slate-700 text-white rounded-xl transition-colors"
        >
          <Apple className="w-6 h-6 fill-white shrink-0" />
          <span className="text-left leading-tight">
            <span className="block text-[10px] text-slate-300">Download on the</span>
            <span className="block text-lg font-semibold -mt-0.5">App Store</span>
          </span>
        </a>
        <p className="mt-6 text-xs text-slate-500">
          Not a bank, broker-dealer, or investment adviser — OmniWealth is a private tracking
          tool only. We never move your money or connect to your financial accounts.
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-teal-700/15 border border-teal-800/50 rounded-xl mb-4">
                <Icon className="w-5 h-5 text-teal-400" />
              </div>
              <h3 className="font-bold text-white mb-1.5">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">How it works</h2>
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4"
            >
              <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-teal-700 text-white font-bold text-sm rounded-full">
                {i + 1}
              </div>
              <p className="text-slate-200">{step}</p>
              <Check className="w-4 h-4 text-teal-500 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer + CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <p className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto mb-8">
          OmniWealth is an informational, personal net-worth tracking tool. It does not execute
          trades, custody funds, act as a broker-dealer, or provide licensed financial advice.
        </p>
        <Link
          href="/login?tab=register"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-teal-900/30"
        >
          Start Tracking Your Wealth <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} OmniWealth. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/help" className="hover:text-slate-300 transition-colors">Help</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* SoftwareApplication + Organization structured data for search rich
          results — explicitly disambiguates from unrelated, similarly-named
          registered investment advisers, and clarifies this is a tracking
          tool, not a financial institution. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'DreamBee Network LLC',
            alternateName: 'OmniWealth',
            url: 'https://www.omniwealth.org',
            email: 'admin@omniwealth.org',
            description:
              'DreamBee Network LLC operates OmniWealth, a personal net-worth tracking application. It is not a bank, broker-dealer, or investment adviser, does not manage or custody funds, and does not provide licensed financial advice.',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'OmniWealth',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'iOS, Android, Web',
            description:
              "Track your family's net worth across bank accounts, investments, property, and more — in one private, multi-currency dashboard. Informational only: not a bank, broker-dealer, or investment adviser, and does not manage, custody, or move your money.",
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        }}
      />
    </div>
  );
}
