import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | OmniWealth',
  description:
    'How DreamBee Network LLC collects, uses, shares, and protects your information in OmniWealth and OmniWealth Kadai.',
};

// Public, unauthenticated page — required for the Google Play store listing.
// Keep it reachable with no login and no geo-block.

const UPDATED = '4 September 2026';
const CONTACT_EMAIL = 'admin@omniwealth.org';
const LLC_STATE = 'the State of Texas';

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-10 scroll-mt-24 text-lg font-semibold text-slate-900 dark:text-slate-100"
    >
      {children}
    </h2>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
        DreamBee Network LLC
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Last updated: {UPDATED}
      </p>

      <p className="mt-6">
        This Privacy Policy explains how <strong>DreamBee Network LLC</strong> (a
        limited liability company organized in {LLC_STATE}; &ldquo;DreamBee,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and protects
        information when you use <strong>OmniWealth</strong> (our web application
        and Android app) and <strong>OmniWealth Kadai</strong> (our Android app
        for shops). These are referred to together as the &ldquo;Services.&rdquo;
      </p>
      <p className="mt-4">
        If you do not agree with this policy, please do not use the Services.
      </p>

      <H2 id="who-we-are">Who we are</H2>
      <p>
        DreamBee Network LLC is the data controller for information processed
        through the Services. You can reach us at{' '}
        <a
          className="text-teal-700 underline dark:text-teal-400"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <H2 id="information-we-collect">Information we collect</H2>
      <p className="mt-2 font-medium text-slate-900 dark:text-slate-200">
        Information you provide
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Account details</strong> &mdash; your name, email address, and
          password (stored only as a salted hash).
        </li>
        <li>
          <strong>Financial records you enter</strong> &mdash; assets,
          liabilities, valuations, account identifiers or numbers you choose to
          add, notes and rationale, currency, and retirement-planning inputs.
        </li>
        <li>
          <strong>Household members</strong> you add, and any details you record
          about them.
        </li>
        <li>
          <strong>Documents you upload</strong> &mdash; account statements or
          similar files you submit so the app can extract line items for you.
        </li>
        <li>
          <strong>Your own AI provider key</strong>, if you choose to add one.
          It is encrypted at rest (AES-256-GCM) and used only to make requests
          you initiate.
        </li>
        <li>
          <strong>Preferences</strong> &mdash; such as base currency, theme, and
          notification settings.
        </li>
        <li>
          <strong>OmniWealth Kadai shop data</strong> &mdash; products, prices,
          stock counts and movements, sales and bills, refunds, suppliers,
          payments, and GST/tax settings you enter for your shop.
        </li>
        <li>
          <strong>Messages you send us</strong> &mdash; for example, support
          requests.
        </li>
      </ul>

      <p className="mt-4 font-medium text-slate-900 dark:text-slate-200">
        Information collected automatically
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Session and security data</strong> &mdash; session tokens,
          sign-in timestamps, and IP address, used to keep you signed in and to
          detect and rate-limit abuse.
        </li>
        <li>
          <strong>Device and app information</strong> &mdash; app version,
          browser or operating-system type, and general device characteristics,
          used for compatibility and troubleshooting.
        </li>
        <li>
          <strong>Usage and performance analytics</strong> &mdash; we use Vercel
          Analytics and Vercel Speed Insights to collect aggregated, non-identifying
          data such as page views, approximate region, and page-load metrics, to
          understand and improve reliability.
        </li>
      </ul>

      <p className="mt-4">
        The Services do <strong>not</strong> connect to your bank or brokerage
        accounts, do not process payments or transfers, and do not execute any
        trades or transactions. All financial figures are entered by you.
      </p>

      <H2 id="how-we-use">How we use information</H2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>To provide, operate, and maintain the Services and your account.</li>
        <li>To authenticate you and sync your data across your devices.</li>
        <li>
          To extract structured data from documents you upload, using an AI
          provider (see below).
        </li>
        <li>
          To calculate summaries, allocations, and projections from the data you
          entered.
        </li>
        <li>To secure the Services and prevent fraud and abuse.</li>
        <li>To respond to your requests and provide support.</li>
        <li>To comply with legal obligations and enforce our terms.</li>
      </ul>

      <H2 id="ai-processing">AI processing of your content</H2>
      <p>
        When you use a feature that reads a document or free-text you submit
        (for example, the statement reader or the in-app assistant), the
        relevant content is sent to a third-party AI provider solely to return a
        result to you. By default this provider is <strong>Google (Gemini)</strong>.
        Other providers (such as OpenAI or Anthropic) are used only if you add
        your own API key for them, in which case those requests go to the
        provider you chose under that provider&rsquo;s own terms and privacy
        policy. Where a provider offers the option, we request that your content
        not be used to train their models.
      </p>

      <H2 id="how-we-share">How we share information</H2>
      <p>
        We do not sell your personal information and we do not share it for
        advertising. We share it only in these cases:
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Service providers</strong> acting on our instructions:{' '}
          <em>Vercel</em> (application hosting and analytics), <em>Neon</em>{' '}
          (database hosting), <em>Resend</em> (transactional email),{' '}
          <em>Google</em> (AI processing via Gemini, and app distribution
          through Google Play), and any AI provider whose key you add yourself.
        </li>
        <li>
          <strong>Market data sources</strong> &mdash; we retrieve public asset
          and currency prices from providers such as CoinGecko. No personal
          information is sent to them.
        </li>
        <li>
          <strong>Legal and safety</strong> &mdash; when required by law, or to
          protect the rights, property, or safety of DreamBee, our users, or the
          public.
        </li>
        <li>
          <strong>Business transfers</strong> &mdash; in connection with a
          merger, acquisition, or sale of assets, with notice to you.
        </li>
      </ul>

      <H2 id="storage-security">Storage and security</H2>
      <p>
        Your data is stored on managed infrastructure operated by our providers,
        including in the United States. Passwords are hashed, provider API keys
        are encrypted at rest, and data is transmitted over TLS. Access is
        limited to what is needed to operate the Services. No method of
        transmission or storage is completely secure, and we cannot guarantee
        absolute security.
      </p>

      <H2 id="retention">Data retention</H2>
      <p>
        We keep your information for as long as your account is active. After you
        delete your account, we delete or irreversibly anonymize your personal
        data within <strong>90 days</strong>, except where we must retain limited
        records to meet legal, tax, or accounting requirements or to resolve
        disputes.
      </p>

      <H2 id="account-deletion">How to delete your account and data</H2>
      <p>
        You can request deletion of your account and all associated personal
        data at any time:
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          In the app, open <strong>Profile &rarr; Security</strong> and use{' '}
          <strong>Delete account</strong> (you will be asked to confirm your
          password); or
        </li>
        <li>
          email{' '}
          <a
            className="text-teal-700 underline dark:text-teal-400"
            href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20account`}
          >
            {CONTACT_EMAIL}
          </a>{' '}
          from the address on your account.
        </li>
      </ul>
      <p className="mt-3">
        We complete verified deletion requests within 90 days and confirm by
        email. Deleting the app from your device does not by itself delete data
        stored in your account.
      </p>

      <H2 id="your-rights">Your rights and choices</H2>
      <p>
        You can view, correct, and export your data from within the app, and
        request deletion as described above. Depending on where you live (for
        example the EEA, the United Kingdom, or California), you may also have
        the right to access, correct, delete, port, or restrict processing of
        your personal information, to object to certain processing, and not to
        receive discriminatory treatment for exercising these rights. To make a
        request, contact us at{' '}
        <a
          className="text-teal-700 underline dark:text-teal-400"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
        . We may need to verify your identity before acting.
      </p>

      <H2 id="children">Children</H2>
      <p>
        The Services are not directed to children under 16, and we do not
        knowingly collect personal information from them. If you believe a child
        has provided us information, contact us and we will delete it.
      </p>

      <H2 id="international">International users</H2>
      <p>
        We operate from {LLC_STATE} and use service providers in the United
        States and other countries. If you use the Services from outside those
        countries, your information will be transferred to and processed in them,
        where data-protection laws may differ from those in your location.
      </p>

      <H2 id="changes">Changes to this policy</H2>
      <p>
        We may update this policy from time to time. We will post the revised
        version here and update the &ldquo;Last updated&rdquo; date, and for
        material changes we will provide notice in the app or by email.
      </p>

      <H2 id="contact">Contact us</H2>
      <p>
        DreamBee Network LLC
        <br />
        <a
          className="text-teal-700 underline dark:text-teal-400"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
      </p>

      <hr className="my-10 border-slate-200 dark:border-slate-800" />
      <p className="text-sm">
        <Link
          href="/"
          className="text-teal-700 underline dark:text-teal-400"
        >
          Return to OmniWealth
        </Link>
      </p>
    </main>
  );
}
