import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'Kadai: shop billing, stock and UPI app in Tamil and English' },
  alternates: { canonical: '/kadai' },
  description:
    'Kadai is a billing and stock app for kirana, grocery, medical and general stores. Bill by voice in Tamil or English, sell the oldest stock first, track credit, check UPI payments and close the day. Works offline.',
  openGraph: {
    title: 'Kadai: shop billing, stock and UPI app',
    description:
      'Bill in Tamil or English, sell the oldest stock first, know who owes you and who has paid. Works without internet.',
    url: '/kadai',
    images: [{ url: '/kadai-icon-512.png', width: 512, height: 512 }],
  },
  icons: { icon: [{ url: '/kadai-favicon.png', sizes: '48x48', type: 'image/png' }] },
};

// Public marketing page for the Kadai app. The app itself lives at /stocking
// (behind a sign-in). Keep every claim here true of the shipped app.

const CONTACT_EMAIL = 'admin@omniwealth.org';
const EARLY_ACCESS = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Kadai early access')}&body=${encodeURIComponent('Hello, I would like to try Kadai for my shop.\n\nShop name:\nPlace:\nPhone (Android or iPhone):\n')}`;

function Phone({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      className="h-auto w-full rounded-3xl"
      sizes="(max-width: 768px) 70vw, 280px"
    />
  );
}

function Feature({
  title,
  body,
  img,
  alt,
  w,
  h,
  flip,
}: {
  title: string;
  body: string;
  img: string;
  alt: string;
  w: number;
  h: number;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      <div className={flip ? 'md:order-2' : ''}>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">{body}</p>
      </div>
      <div className={`mx-auto w-56 sm:w-64 ${flip ? 'md:order-1' : ''}`}>
        <Phone src={img} alt={alt} w={w} h={h} />
      </div>
    </div>
  );
}

const QUICK = [
  ['Works offline', 'Billing never waits for the internet.'],
  ['Tamil and English', 'Every screen, and voice billing.'],
  ['Android and iPhone', 'Plus a web version.'],
  ['Many phones, one shop', 'Owner, manager and staff roles.'],
];

const FAQ: [string, string][] = [
  [
    'Does Kadai work without internet?',
    'Yes. Billing, stock and the offline voice fallback work with no signal. Everything saves on the phone and syncs by itself when the connection returns. You sign in once while online.',
  ],
  [
    'Can I speak the items in Tamil?',
    'Yes. Tap the microphone and say the items in Tamil, English or a mix. When you are online and allow it, a short recording is sent to an AI service (Google Gemini) to understand it; the recording is not kept. Offline, Kadai falls back to the phone\'s own recogniser.',
  ],
  [
    'Does Kadai read my SMS?',
    'No. On Android you can switch on matching of PhonePe, Google Pay, Paytm and BHIM payment notifications, and Kadai then reads only those apps\' notifications, only to find "money received" messages. On iPhone you can set up a Shortcut that forwards your bank\'s credit SMS. You can also paste a payment message. Each one is optional and can be turned off.',
  ],
  [
    'Who can see my cost prices and reports?',
    'Owners and managers. Staff can bill and adjust stock but cannot see cost prices, reports or the owner tools.',
  ],
  [
    'Where is my data?',
    'On your phone first, so the shop keeps running offline. It also syncs to our cloud and to your other phones. You can ask us to delete your account and data at any time.',
  ],
  [
    'Is Kadai a GST filing tool?',
    'No. It makes GST-ready bills and exports for your accountant (CSV and Tally XML). The figures come from your own entries and are not a tax filing or tax advice.',
  ],
];

export default function KadaiLandingPage() {
  return (
    <main className="bg-white text-slate-700">
      {/* header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Image src="/kadai-icon-192.png" alt="Kadai" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-extrabold text-slate-900">Kadai</span>
        </div>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-teal-700">Features</a>
          <a href="#tamil" className="hover:text-teal-700">தமிழில்</a>
          <a href="#faq" className="hover:text-teal-700">FAQ</a>
          <a
            href={EARLY_ACCESS}
            className="rounded-lg bg-teal-700 px-3.5 py-2 text-white hover:bg-teal-600"
          >
            Early access
          </a>
        </nav>
      </header>

      {/* hero */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              For kirana, grocery, medical and general stores
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              Bill in Tamil or English.
              <br />
              Sell the oldest stock first.
              <br />
              Know who owes you, and who has paid.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-300">
              One app for your counter: fast billing, expiry-aware stock, credit (கடன்) accounts,
              UPI checking, cash close and barcode labels. It keeps working without internet.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={EARLY_ACCESS}
                className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500"
              >
                Get early access
              </a>
              <a
                href="#features"
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400"
              >
                See what it does
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Android and iPhone apps are rolling out. Write to us for early access.
            </p>
          </div>
          <div className="mx-auto flex w-full max-w-sm items-start justify-center gap-4">
            <div className="w-1/2">
              <Phone src="/kadai/home.jpg" alt="Kadai home screen with today's sales" w={432} h={868} />
            </div>
            <div className="mt-8 w-1/2">
              <Phone src="/kadai/ta-home.jpg" alt="Kadai home screen in Tamil" w={532} h={1072} />
            </div>
          </div>
        </div>
      </section>

      {/* quick facts */}
      <section className="border-b border-slate-200">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:grid-cols-2 md:grid-cols-4">
          {QUICK.map(([t, b]) => (
            <div key={t}>
              <p className="font-bold text-slate-900">{t}</p>
              <p className="mt-1 text-sm text-slate-600">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-5xl scroll-mt-6 space-y-16 px-5 py-16">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">What Kadai does for your shop</h2>
          <p className="mt-2 text-slate-600">
            Screens below are from a sample shop with sample data.
          </p>
        </div>
        <Feature
          title="Bill in seconds, with wholesale rates and schemes"
          body="Scan barcodes, search, or speak the items in Tamil, English or a mix. Hold a bill while you serve the next customer. Pay by cash, UPI, card, credit or a split, and send the bill on WhatsApp. Give products a wholesale rate, switch a bill between retail and wholesale, and run buy-10-get-1-free schemes."
          img="/kadai/sell.jpg"
          alt="A bill with a retail and wholesale switch, a free-item scheme and a sell-first hint"
          w={432}
          h={921}
        />
        <Feature
          flip
          title="Sell the oldest stock first"
          body="Every delivery keeps its own expiry date. At billing Kadai tells you which batch to sell first and offers a one-tap markdown for items close to expiry, so less goes to waste."
          img="/kadai/lots.jpg"
          alt="A product with its batches listed by expiry date"
          w={432}
          h={921}
        />
        <Feature
          title="Check your UPI money"
          body="Match money received against your UPI bills and spot bills with no matching payment. On Android Kadai can read PhonePe, Google Pay and Paytm payment notifications if you allow it; on iPhone a Shortcut can forward your bank SMS; pasting a message works everywhere."
          img="/kadai/upi.jpg"
          alt="UPI check showing bills against money received"
          w={432}
          h={868}
        />
        <Feature
          flip
          title="Close the day and know your cash"
          body="Opening cash plus cash sales and cash received, less cash expenses, gives what the drawer should hold. Enter what you counted and see whether it is short or over."
          img="/kadai/dayclose.jpg"
          alt="Day close screen showing expected and counted cash"
          w={432}
          h={774}
        />
        <Feature
          title="Count the shelf, see the difference in rupees"
          body="Search or scan a product and type what is on the shelf. Nothing changes until you tap Apply. Shortage and extra are shown in rupees, and every change is recorded."
          img="/kadai/count.jpg"
          alt="Stock count screen"
          w={432}
          h={921}
        />
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="md:order-2">
            <h3 className="text-xl font-bold text-slate-900">Barcode labels and weekly reports</h3>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Print price and barcode stickers on an A4 sheet or a label roll. See your weekly sales,
              fast and slow sellers and what to reorder. GST-ready bills, and an export your accountant
              can open (CSV and Tally XML).
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm space-y-4 md:order-1">
            <Image
              src="/kadai/labels.jpg"
              alt="A sheet of price and barcode labels"
              width={572}
              height={432}
              className="h-auto w-full rounded-xl border border-slate-200"
              sizes="(max-width: 768px) 90vw, 384px"
            />
            <div className="mx-auto w-48">
              <Phone src="/kadai/reports.jpg" alt="Weekly sales report" w={432} h={549} />
            </div>
          </div>
        </div>
      </section>

      {/* Tamil */}
      <section id="tamil" className="scroll-mt-6 bg-teal-50">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 md:grid-cols-[1.2fr_1fr]">
          <div lang="ta">
            <h2 className="text-2xl font-extrabold text-slate-900">தமிழில் கடை</h2>
            <p className="mt-4 leading-8 text-slate-700">
              உங்கள் கல்லாவுக்கான ஒரே செயலி: வேகமான பில்லிங், காலாவதி தேதியுடன் சரக்கு, கடன் கணக்கு,
              UPI சரிபார்ப்பு, நாள் முடிவு, பார்கோடு லேபிள்கள். இணையம் இல்லாமலும் வேலை செய்யும்.
            </p>
            <ul className="mt-4 space-y-2 leading-8 text-slate-700">
              <li>• எல்லாத் திரைகளும் தமிழிலும் ஆங்கிலத்திலும்.</li>
              <li>• குரலில் பொருட்களைச் சொல்லுங்கள்: தமிழ், ஆங்கிலம் அல்லது கலந்து.</li>
              <li>• பழைய சரக்கை முதலில் விற்கவும்; காலாவதி நெருங்கினால் விலைக் குறைப்பு.</li>
              <li>• யாரிடம் கடன் வர வேண்டும், யார் பணம் கொடுத்தார் என்று தெரிந்துகொள்ளுங்கள்.</li>
            </ul>
            <a
              href={EARLY_ACCESS}
              className="mt-6 inline-block rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-600"
            >
              முன்கூட்டியே பயன்படுத்தப் பதிவு செய்யுங்கள்
            </a>
          </div>
          <div className="mx-auto flex w-full max-w-xs gap-4">
            <div className="w-1/2">
              <Phone src="/kadai/ta-sell.jpg" alt="Kadai billing screen in Tamil" w={532} h={1137} />
            </div>
            <div className="mt-8 w-1/2">
              <Phone src="/kadai/ta-home.jpg" alt="Kadai home in Tamil" w={532} h={1072} />
            </div>
          </div>
        </div>
      </section>

      {/* start */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-extrabold text-slate-900">Getting started</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ['Sign in', 'Use the account created for your shop. You need internet once.'],
            ['Add your products', 'Import a sheet, photograph a supplier bill, or add items as you go.'],
            ['Take your first bill', 'Everything else is one tap away in Settings.'],
          ].map(([t, b], i) => (
            <li key={t} className="rounded-2xl bg-slate-50 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-3 font-bold text-slate-900">{t}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-6 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="text-2xl font-extrabold text-slate-900">Questions shopkeepers ask</h2>
          <div className="mt-6 divide-y divide-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
                  <span className="mr-2 text-teal-700 group-open:hidden">+</span>
                  <span className="mr-2 hidden text-teal-700 group-open:inline">−</span>
                  {q}
                </summary>
                <p className="mt-2 pl-5 text-[15px] leading-7 text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + footer */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-5 py-14 text-center">
          <h2 className="text-2xl font-extrabold">Try Kadai in your shop</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Write to us with your shop name and place, and whether you use Android or iPhone.
          </p>
          <a
            href={EARLY_ACCESS}
            className="mt-6 inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white hover:bg-teal-500"
          >
            Email us for early access
          </a>
          <p className="mt-3 text-sm text-slate-400">{CONTACT_EMAIL}</p>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-slate-400">
            <span>OmniWealth Kadai, by DreamBee Network LLC</span>
            <span className="flex gap-4">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/delete-account" className="hover:text-white">Delete your data</Link>
              <Link href="/" className="hover:text-white">OmniWealth</Link>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
