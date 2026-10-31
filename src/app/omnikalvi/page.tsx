import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import EarlyAccess from '@/components/EarlyAccess';

export const metadata: Metadata = {
  title: { absolute: 'OmniKalvi: school attendance, homework, notices, fees and canteen app' },
  alternates: { canonical: '/omnikalvi' },
  description:
    'OmniKalvi puts the school day on the phones teachers and parents already have: attendance in seconds, homework with photos and PDFs, notices parents confirm, fees, marks, bus and a canteen with allergy checks. In English and Tamil.',
  openGraph: {
    title: 'OmniKalvi: your school, running in one app',
    description:
      'Attendance, homework, notices, fees, bus and canteen for schools of every size. In English and Tamil.',
    url: '/omnikalvi',
    images: [{ url: '/omnikalvi-og.png', width: 1200, height: 630 }],
  },
  icons: { icon: [{ url: '/omnikalvi-favicon.png', sizes: '48x48', type: 'image/png' }] },
};

// Public marketing page for the OmniKalvi app. The app itself lives at omnikalvi.omniwealth.org (behind a sign-in).
// Keep every claim here true of the shipped app. Screens below are from a demo school with fictional data.

const CONTACT_EMAIL = 'admin@omniwealth.org';
const APP_URL = 'https://omnikalvi.omniwealth.org';
const DEMO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('OmniKalvi live demo')}&body=${encodeURIComponent('Hello, I would like a live demo of OmniKalvi for our school.\n\nSchool name:\nPlace:\nNumber of students (approx.):\nYour role:\nPhone (optional):\n')}`;

const PLAY_TEST_URL = 'https://play.google.com/apps/testing/com.omniwealth.schoolos';
const EARLY = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('OmniKalvi Android early access')}&body=${encodeURIComponent('Hello, please add me to the OmniKalvi Android test.\n\nMy Google account email:\nMy role (parent, teacher, school owner):\nSchool name and place:\n')}`;

function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={540}
      height={960}
      className="h-auto w-full rounded-3xl border border-slate-200 shadow-lg"
      sizes="(max-width: 768px) 70vw, 280px"
    />
  );
}

function Feature({
  title,
  body,
  img,
  alt,
  flip,
}: {
  title: string;
  body: string;
  img: string;
  alt: string;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      <div className={flip ? 'md:order-2' : ''}>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">{body}</p>
      </div>
      <div className={`mx-auto w-52 sm:w-60 ${flip ? 'md:order-1' : ''}`}>
        <Phone src={img} alt={alt} />
      </div>
    </div>
  );
}

const QUICK = [
  ['English and Tamil', 'Every screen, for staff and parents.'],
  ['Ordinary phones', 'No special equipment to buy.'],
  ['One app, five roles', 'Principal, teacher, accountant, canteen and parent.'],
  ['Parents see only their own', 'Each parent sees only their own children.'],
];

const MORE: [string, string][] = [
  ['Bus and transport', 'Routes, stops and rider lists. The attendant starts a trip, marks boarding and drop-off, and parents see where the bus is, only while a trip runs.'],
  ['Marks and report cards', 'Teachers enter marks once. Parents see published results, and the school prints report cards, ID cards and certificates.'],
  ['Fees at a glance', 'The principal sees collection, who has paid and a clear overdue list, class by class, with receipts and a daily cash close.'],
  ['Parents stay close', 'Meetings, calendar, leave requests and messages with teachers, in one parent view, for their own children only.'],
  ['Staff and payslips', 'Staff attendance, leave and payslips for schools that do not already have a system for them.'],
  ['Admissions', 'A public enquiry form, and enquiries become students in a few taps.'],
];

const FAQ: [string, string][] = [
  [
    'Who uses OmniKalvi?',
    'Principals, teachers, accountants, canteen staff and parents. Children do not sign in. Each person sees only what their role allows, and a parent sees only their own children.',
  ],
  [
    'How do staff and parents get their accounts?',
    'The school creates them. A person signs in with their email or mobile number, and the first time a one-time code helps them choose a password.',
  ],
  [
    'Where is our data kept?',
    'Your school\'s data is hosted in Mumbai. OmniKalvi is built to keep each school\'s information separate, and it is never sold or used for advertising. We are preparing for India\'s DPDP Act, and a legal review is under way.',
  ],
  [
    'Can parents pay online?',
    'Where your school turns online payments on, parents can pay fees and top up the canteen balance online. Otherwise the office records cash and bank payments, and parents still see their receipts and balances.',
  ],
  [
    'How does the canteen allergy check work?',
    'A parent records a child\'s food allergy. At the counter, OmniKalvi refuses to sell an item that contains it, or whose allergen list the canteen has not confirmed. Only a principal or accountant can override, with a written reason that is recorded. It is a safety aid, and the school stays responsible for what it serves.',
  ],
  [
    'Does it work in Tamil?',
    'Yes. Staff and parents can use every screen in Tamil or English and switch at any time.',
  ],
  [
    'Is there an app?',
    'OmniKalvi works in the browser. The Android app is in closed testing on Google Play (ask to join the early-access test below), and the iPhone app is coming soon to the App Store.',
  ],
];

export default function OmniKalviLandingPage() {
  return (
    <main className="bg-white text-slate-700">
      {/* header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Image src="/omnikalvi-icon-192.png" alt="OmniKalvi" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-extrabold text-slate-900">OmniKalvi</span>
        </div>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
          <a href="#features" className="hidden hover:text-teal-700 sm:inline">Features</a>
          <a href="#tamil" className="hover:text-teal-700">தமிழில்</a>
          <a href="#early" className="hidden hover:text-teal-700 sm:inline">Early access</a>
          <a href="#faq" className="hover:text-teal-700">FAQ</a>
          <a href={DEMO} className="rounded-lg bg-teal-700 px-3.5 py-2 text-white hover:bg-teal-600">
            Ask for a demo
          </a>
        </nav>
      </header>

      {/* hero */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Built for schools of every size
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              Your school, running in one app: attendance, homework, notices and canteen.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-300">
              No more paper registers, lost diary notes and lunch-money cash. OmniKalvi puts the whole
              school day on the phones your staff and parents already have, in English and Tamil.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={DEMO} className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-500">
                Ask for a live demo
              </a>
              <a
                href="#features"
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-400"
              >
                See what it does
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              The Android app is in closed testing and the iPhone app is coming soon. Ask for a live demo or join the early-access test.
            </p>
          </div>
          <div className="mx-auto flex w-full max-w-sm items-start justify-center gap-4">
            <div className="w-1/2">
              <Phone src="/omnikalvi/parent-home.jpg" alt="OmniKalvi parent home: the child's day on one screen" />
            </div>
            <div className="mt-8 w-1/2">
              <Phone src="/omnikalvi/principal.jpg" alt="OmniKalvi principal overview of the whole school" />
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
          <h2 className="text-2xl font-extrabold text-slate-900">What OmniKalvi does for your school</h2>
          <p className="mt-2 text-slate-600">Screens below are from a demo school with fictional data.</p>
        </div>
        <Feature
          title="Parents see their child's day on one screen"
          body="Attendance, homework, notices, fees and messages sit on one home screen, with a short list of what needs the parent's attention: a form to answer, a meeting to book, a notice to confirm."
          img="/omnikalvi/parent-home.jpg"
          alt="Parent home screen with tiles and a needs-attention list"
        />
        <Feature
          flip
          title="Homework that parents actually see"
          body="Teachers post homework and class work with photos and PDFs, class by class. Parents see exactly what was assigned and when it is due, in Tamil or English. No lost diary notes."
          img="/omnikalvi/homework.jpg"
          alt="Homework list with subjects and due dates, including a Tamil entry"
        />
        <Feature
          title="Notices that land"
          body="Choose who gets a notice, confirm the audience before it goes out, mark it urgent, see who has read and acknowledged it, and withdraw it within the hour if you need to."
          img="/omnikalvi/notices.jpg"
          alt="Notices list with an urgent notice and acknowledge buttons"
        />
        <Feature
          flip
          title="A canteen that shows what is in the food"
          body="The menu lists portions and allergens. Parents top up in advance (online where the school enables it, or at the office), set a daily limit, freeze spending in one tap and see every purchase. If a child has a recorded allergy, the counter will not sell them an item that contains it."
          img="/omnikalvi/canteen.jpg"
          alt="Canteen menu item opened to show its allergens"
        />
        <Feature
          title="Teachers: attendance in seconds"
          body="Mark the class from your phone, post homework or mark a no-homework day, send a notice, enter marks and reply to parents. The home screen shows what is still to do today."
          img="/omnikalvi/teacher.jpg"
          alt="Teacher home with a to-do list and a Mark attendance button"
        />
        <Feature
          flip
          title="Principals: the whole school at a glance"
          body="See which classes have not marked attendance, who has acknowledged important notices, fees overdue, staff attendance, admissions and buses, all on one screen."
          img="/omnikalvi/principal.jpg"
          alt="Principal overview with attendance, needs-attention items and tools"
        />
        <div>
          <h3 className="text-xl font-bold text-slate-900">And the rest of the school day</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {MORE.map(([t, b]) => (
              <div key={t} className="rounded-2xl bg-slate-50 p-5">
                <p className="font-bold text-slate-900">{t}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tamil */}
      <section id="tamil" className="scroll-mt-6 bg-teal-50">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <div lang="ta" className="max-w-2xl">
            <h2 className="text-2xl font-extrabold text-slate-900">தமிழில் பள்ளி</h2>
            <p className="mt-4 leading-8 text-slate-700">
              உங்கள் பள்ளியின் ஒரு நாள் முழுவதும் ஒரே செயலியில்: வருகைப் பதிவு, வீட்டுப்பாடம், அறிவிப்புகள், உணவகம்.
              ஆசிரியர்களும் பெற்றோரும் ஏற்கனவே பயன்படுத்தும் கைபேசியிலேயே.
            </p>
            <ul className="mt-4 space-y-2 leading-8 text-slate-700">
              <li>• எல்லாத் திரைகளும் தமிழிலும் ஆங்கிலத்திலும் கிடைக்கும்.</li>
              <li>• ஆசிரியர்கள் வருகையைக் கைபேசியிலேயே சில நொடிகளில் பதிவு செய்யலாம்.</li>
              <li>• பெற்றோர் தங்கள் குழந்தையின் வீட்டுப்பாடம், அறிவிப்புகள், கட்டணம் ஆகியவற்றைப் பார்க்கலாம்.</li>
              <li>• உணவகத்தில் உணவுப் பொருட்களின் ஒவ்வாமைத் தகவல் இருக்கும். பெற்றோர் தினசரி செலவு வரம்பும் வைக்கலாம்.</li>
            </ul>
            <a
              href={DEMO}
              className="mt-6 inline-block rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-600"
            >
              செயல்விளக்கம் கேளுங்கள்
            </a>
          </div>
        </div>
      </section>

      <EarlyAccess app="OmniKalvi" testUrl={PLAY_TEST_URL} requestHref={EARLY} />

      {/* start */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-extrabold text-slate-900">Getting started</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ['Ask for a live demo', 'See your own classes, attendance and canteen menu set up, and watch a teacher mark attendance.'],
            ['We set up your school', 'Classes, teachers and parents are added by the school. Everyone signs in with their email or mobile number.'],
            ['Start the school day', 'Attendance, homework and notices from the first morning. Add fees, bus and canteen when you are ready.'],
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
          <h2 className="text-2xl font-extrabold text-slate-900">Questions schools ask</h2>
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
          <h2 className="text-2xl font-extrabold">See OmniKalvi with your own classes</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Write to us with your school name, place and roughly how many students you have, and we will arrange a live demo.
          </p>
          <a
            href={DEMO}
            className="mt-6 inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white hover:bg-teal-500"
          >
            Email us for a demo
          </a>
          <p className="mt-3 text-sm text-slate-400">{CONTACT_EMAIL}</p>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-slate-400">
            <span>OmniKalvi, an OmniWealth product. Data hosted in Mumbai. DPDP review under way.</span>
            <span className="flex flex-wrap gap-4">
              <a href={APP_URL} className="hover:text-white">Open the app</a>
              <a href={`${APP_URL}/privacy`} className="hover:text-white">Privacy</a>
              <a href={`${APP_URL}/delete-account`} className="hover:text-white">Delete your data</a>
              <Link href="/" className="hover:text-white">OmniWealth</Link>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
