import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | OmniWealth',
  description:
    'The terms under which DreamBee Network LLC provides OmniWealth and OmniWealth Kadai.',
};

// Public, unauthenticated page. Keep it reachable with no login.

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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-400">
        DreamBee Network LLC
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
        Terms of Service
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Last updated: {UPDATED}
      </p>

      <p className="mt-6">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of{' '}
        <strong>OmniWealth</strong> and <strong>OmniWealth Kadai</strong> (the
        &ldquo;Services&rdquo;), provided by <strong>DreamBee Network LLC</strong>,
        a limited liability company organized in {LLC_STATE} (&ldquo;DreamBee,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account or using the
        Services, you agree to these Terms and to our{' '}
        <Link
          href="/privacy"
          className="text-teal-700 underline dark:text-teal-400"
        >
          Privacy Policy
        </Link>
        . If you do not agree, do not use the Services.
      </p>

      <H2 id="what-the-services-are">1. What the Services are</H2>
      <p>
        OmniWealth is a private tool for recording and reviewing a
        household&rsquo;s assets, liabilities, and financial goals. OmniWealth
        Kadai is a tool for recording stock and sales for a small shop. The
        Services present information you enter and calculations derived from it.
      </p>
      <p className="mt-3">
        The Services are <strong>for informational purposes only</strong>. They
        do not provide investment, financial, tax, accounting, or legal advice,
        do not recommend any transaction or product, and do not create any
        advisory or fiduciary relationship. Figures, projections, and AI-generated
        output may be inaccurate or incomplete &mdash; verify anything important
        with a qualified professional before relying on it. The Services do not
        connect to your financial accounts, hold funds, or execute transactions.
      </p>

      <H2 id="your-account">2. Your account</H2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          You must provide accurate information and keep your password secure.
          You are responsible for activity under your account.
        </li>
        <li>
          An account is for one person. A household or shop owner may invite
          additional members and assign them roles; the owner is responsible for
          who they invite and what those members can see or do.
        </li>
        <li>
          You must be at least 18 years old to use the Services.
        </li>
        <li>
          Notify us promptly at{' '}
          <a
            className="text-teal-700 underline dark:text-teal-400"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>{' '}
          if you believe your account has been compromised.
        </li>
      </ul>

      <H2 id="your-content">3. Your content</H2>
      <p>
        You keep all rights to the data and documents you add to the Services
        (&ldquo;Your Content&rdquo;). You grant DreamBee a limited licence to
        store, process, and display Your Content solely to operate and provide
        the Services to you and the members you authorise, including sending
        content you submit to an AI provider for processing when you use a
        feature that requires it. You represent that you have the right to upload
        Your Content and that it does not infringe anyone else&rsquo;s rights.
      </p>

      <H2 id="acceptable-use">4. Acceptable use</H2>
      <p>You agree not to:</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>use the Services unlawfully or to store unlawful content;</li>
        <li>
          probe, scan, overload, or attempt to gain unauthorised access to the
          Services or other users&rsquo; data;
        </li>
        <li>
          reverse engineer, decompile, scrape, or build a competing product from
          the Services, except where that restriction is prohibited by law;
        </li>
        <li>
          resell or provide the Services to third parties outside your own
          household or shop;
        </li>
        <li>
          upload malware or interfere with the integrity or performance of the
          Services.
        </li>
      </ul>

      <H2 id="availability-changes">5. Availability and changes</H2>
      <p>
        The Services are provided on an &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; basis. We may add, change, suspend, or discontinue
        features, and may perform maintenance that makes the Services temporarily
        unavailable. We will try to give reasonable notice of material changes
        that adversely affect you.
      </p>

      <H2 id="fees">6. Fees</H2>
      <p>
        The Services are currently provided free of charge. If we introduce paid
        plans, we will describe the price and terms before you are charged, and
        continued use of a paid feature after that point means you accept those
        terms.
      </p>

      <H2 id="termination">7. Termination</H2>
      <p>
        You may stop using the Services and delete your account at any time from
        <strong> Settings &rarr; Security</strong>. We may suspend or terminate
        your access if you materially breach these Terms, if required by law, or
        if continuing to provide the Services to you creates a legal or security
        risk. On termination, the licence in section 3 ends and we will delete or
        anonymise Your Content as described in the Privacy Policy, except where we
        must retain limited records by law.
      </p>

      <H2 id="disclaimers">8. Disclaimers</H2>
      <p>
        To the fullest extent permitted by law, the Services are provided without
        warranties of any kind, whether express or implied, including implied
        warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that the Services will be
        uninterrupted, error-free, or that any calculation or AI output is
        accurate, complete, or suitable for your circumstances.
      </p>

      <H2 id="limitation-of-liability">9. Limitation of liability</H2>
      <p>
        To the fullest extent permitted by law, DreamBee will not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or
        for any loss of profits, data, goodwill, or other intangible losses,
        arising out of or relating to your use of &mdash; or inability to use
        &mdash; the Services. Our total liability for any claim relating to the
        Services will not exceed one hundred US dollars (US $100), or the amount
        you paid us for the Services in the twelve months before the claim,
        whichever is greater. Some jurisdictions do not allow certain of these
        limitations, so parts of this section may not apply to you.
      </p>

      <H2 id="changes-to-terms">10. Changes to these Terms</H2>
      <p>
        We may update these Terms from time to time. We will post the revised
        version here and update the &ldquo;Last updated&rdquo; date, and for
        material changes we will provide notice in the app or by email. Continued
        use after the changes take effect means you accept the revised Terms.
      </p>

      <H2 id="governing-law">11. Governing law</H2>
      <p>
        These Terms are governed by the laws of {LLC_STATE} and the United
        States, without regard to conflict-of-law rules. The exclusive venue for
        any dispute that is not subject to arbitration or small-claims court is
        the state and federal courts located in Texas, and you consent to their
        jurisdiction.
      </p>

      <H2 id="contact">12. Contact</H2>
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
        <Link href="/" className="text-teal-700 underline dark:text-teal-400">
          Return to OmniWealth
        </Link>
      </p>
    </main>
  );
}
