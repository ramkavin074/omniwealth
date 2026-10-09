import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete your account and data',
  alternates: { canonical: '/delete-account' },
  description:
    'How to ask DreamBee Network LLC to delete your OmniWealth or OmniWealth Kadai account and the data linked to it.',
};

// Public, unauthenticated page: the account-deletion link that the Google Play
// Data safety form asks for. Keep it reachable with no login.

const CONTACT_EMAIL = 'admin@omniwealth.org';

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-9 text-lg font-semibold text-slate-900">{children}</h2>;
}

export default function DeleteAccountPage() {
  const subject = encodeURIComponent('Delete my Kadai account');
  const body = encodeURIComponent(
    'Please delete my Kadai account and the shop data linked to it.\n\nAccount email:\nShop name:\n',
  );
  return (
    <main className="bg-white mx-auto max-w-2xl px-5 py-14 text-[15px] leading-7 text-slate-700">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-700 transition-colors"
      >
        ← Back to OmniWealth
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-teal-700">
        DreamBee Network LLC
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        Delete your account and data
      </h1>
      <p className="mt-4">
        This page explains how to ask us to delete your <strong>OmniWealth Kadai</strong> (shop
        billing and stock app) or <strong>OmniWealth</strong> account and the data linked to it.
      </p>

      <H2>OmniWealth Kadai: delete it yourself, in the app</H2>
      <p className="mt-3">
        Open the Kadai app, go to <strong>Settings, then Account, then Delete my account</strong>,
        and enter your password to confirm. The account is deleted straight away. If you are the
        only owner of the shop, the shop and all its data are deleted with it. This cannot be undone.
      </p>

      <H2>Or ask us to do it</H2>
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        <li>
          Email{' '}
          <a
            className="text-teal-700 underline"
            href={`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`}
          >
            {CONTACT_EMAIL}
          </a>{' '}
          <strong>from the email address of your Kadai account</strong>, with the subject
          &ldquo;Delete my Kadai account&rdquo; and your shop name.
        </li>
        <li>
          We confirm it is you (we reply to the same address) and delete the account.
        </li>
        <li>
          We complete verified requests within <strong>90 days</strong> and confirm by email.
        </li>
      </ol>

      <H2>What is deleted</H2>
      <ul className="mt-3 list-disc space-y-1.5 pl-6">
        <li>Your account (name, email, sign-in).</li>
        <li>
          The shop data stored in our cloud: products, stock movements, bills and refunds,
          customers and their balances, suppliers, purchases, expenses, UPI receipts and day
          closes, and any saved settings.
        </li>
        <li>
          The shop&rsquo;s data belongs to the shop owner, so a request from the owner deletes
          the shop; a request from a staff member removes that person&rsquo;s access and name.
        </li>
        <li>
          Data stored only on your phone is removed when you uninstall the app or choose to
          clear its data.
        </li>
      </ul>

      <H2>Ask us to delete only some data</H2>
      <p className="mt-3">
        You can also email us to delete specific data (for example customer records or old
        bills) without deleting the whole account. Say what you would like removed.
      </p>

      <H2>What we may keep</H2>
      <p className="mt-3">
        We may keep limited records where the law requires it (for example tax or accounting
        records) or to resolve a dispute. Anything kept is limited to what is required, is not
        used for anything else, and is deleted or irreversibly anonymized when no longer
        needed. Backups are overwritten on their normal schedule.
      </p>

      <H2>OmniWealth (wealth app)</H2>
      <p className="mt-3">
        In the app, open <strong>Profile, then Security, and use Delete account</strong>. You
        will be asked to confirm your password. You can also email us as above.
      </p>

      <p className="mt-9">
        More detail is in our{' '}
        <Link href="/privacy" className="text-teal-700 underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-3">
        DreamBee Network LLC
        <br />
        <a className="text-teal-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </p>
    </main>
  );
}
