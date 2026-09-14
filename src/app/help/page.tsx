import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description:
    'How to use OmniWealth: setting up a household, tracking assets across currencies, the secure document vault, Ask Wealth AI, retirement planning, and account security.',
};

// Public, unauthenticated help/FAQ page — doubles as SEO content and as
// documentation for anyone (including App Review) trying to understand
// what the app does without signing in first.

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{q}</h3>
      <p className="mt-1.5 text-[15px] leading-7 text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  );
}

const TOC = [
  ['getting-started', 'Getting Started'],
  ['tracking-wealth', 'Tracking Your Wealth'],
  ['document-vault', 'Document Vault'],
  ['ask-wealth-ai', 'Ask Wealth AI'],
  ['retirement', 'Retirement Planning'],
  ['security', 'Security & Privacy'],
  ['family', 'Family & Roles'],
] as const;

export default function HelpPage() {
  const faqs = [
    {
      q: 'What is OmniWealth?',
      a: 'OmniWealth is a private, family-oriented net-worth and wealth-tracking app. It gives a household a single multi-currency dashboard across bank accounts, investments, property, and other assets, plus a secure document vault, an AI portfolio assistant, and a retirement projection calculator.',
    },
    {
      q: 'How do I create a household?',
      a: 'From the sign-in page, choose "New Household," pick a household name and base currency, and create your account. You become the household Owner.',
    },
    {
      q: 'How do I invite family members?',
      a: 'From Profile → Household Settings, add a family member by email to send them an invite link, or share your household\'s invite code so they can join themselves from the sign-in page.',
    },
    {
      q: 'What currencies are supported?',
      a: 'USD, EUR, GBP, CAD, AUD, INR, JPY, CHF, and CNY. Your household picks one base currency, and every asset in a different native currency is converted using live exchange rates.',
    },
    {
      q: 'What kinds of assets can I track?',
      a: 'Stocks, crypto, mutual funds, cash, real estate, retirement accounts, pensions, HSAs, commodities, and liabilities like mortgages or loans — with live price refresh for stocks, crypto, and mutual funds.',
    },
    {
      q: 'How secure is the Document Vault?',
      a: 'Documents are encrypted at rest with AES-256-GCM. It\'s built for the paperwork that matters most — wills, deeds, trust documents, and statements — kept private and always reachable.',
    },
    {
      q: 'What can I ask Wealth AI?',
      a: 'Anything about your own household\'s portfolio — total net worth, concentration risk, how a specific holding is performing, or general questions about your financial picture. It only ever answers from your signed-in household\'s own data.',
    },
    {
      q: 'How does the retirement calculator work?',
      a: 'It projects your portfolio forward using your expected return, inflation rate, and monthly contributions, so you can see roughly where you\'ll land by your target retirement age.',
    },
    {
      q: 'Is my data private?',
      a: 'Yes. OmniWealth is built for one household at a time — your data is never shared, sold, or used to train models. Optional Face ID / passcode app lock can be turned on in Settings → Security for extra protection on your device.',
    },
    {
      q: 'How do I delete my account?',
      a: 'Go to Settings → Security → Delete Account. This permanently removes your account and its data and cannot be undone.',
    },
    {
      q: 'What roles exist for family members?',
      a: 'Owner and Admin can manage the household, add members, and edit any asset. Members can manage their own assets. Access can be revoked at any time from Household Settings.',
    },
  ];

  return (
    <main className="bg-white mx-auto max-w-2xl px-5 py-14 text-slate-700 dark:text-slate-300">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
        OmniWealth
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">Help &amp; FAQ</h1>
      <p className="mt-3 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
        Everything you need to get started tracking your family&rsquo;s net worth in OmniWealth.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-xs">
        {TOC.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 hover:border-teal-300 dark:hover:border-teal-800 transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <Section id="getting-started" title="Getting Started">
        <QA q={faqs[0].q}>{faqs[0].a}</QA>
        <QA q={faqs[1].q}>{faqs[1].a}</QA>
        <QA q={faqs[2].q}>{faqs[2].a}</QA>
        <QA q={faqs[3].q}>{faqs[3].a}</QA>
      </Section>

      <Section id="tracking-wealth" title="Tracking Your Wealth">
        <QA q={faqs[4].q}>{faqs[4].a}</QA>
        <QA q="How often are prices updated?">
          Tap the refresh icon on your dashboard to pull the latest stock, crypto, and mutual
          fund prices on demand.
        </QA>
      </Section>

      <Section id="document-vault" title="Document Vault">
        <QA q={faqs[5].q}>{faqs[5].a}</QA>
      </Section>

      <Section id="ask-wealth-ai" title="Ask Wealth AI">
        <QA q={faqs[6].q}>{faqs[6].a}</QA>
      </Section>

      <Section id="retirement" title="Retirement Planning">
        <QA q={faqs[7].q}>{faqs[7].a}</QA>
      </Section>

      <Section id="security" title="Security & Privacy">
        <QA q={faqs[8].q}>{faqs[8].a}</QA>
        <QA q={faqs[9].q}>{faqs[9].a}</QA>
      </Section>

      <Section id="family" title="Family & Roles">
        <QA q={faqs[10].q}>{faqs[10].a}</QA>
      </Section>

      <p className="mt-14 text-sm text-slate-500 dark:text-slate-500">
        Still have a question?{' '}
        <a href="mailto:admin@omniwealth.org" className="text-teal-700 dark:text-teal-400 hover:underline">
          admin@omniwealth.org
        </a>
      </p>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </p>

      {/* FAQPage structured data for search rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </main>
  );
}
