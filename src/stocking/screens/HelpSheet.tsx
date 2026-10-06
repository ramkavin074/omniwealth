'use client';

import type { Lang } from '../i18n';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';

interface Topic {
  title: string;
  body: string;
}

// Short, plain-language how-tos. Kept here (not in i18n.ts) so the copy can be
// edited as readable paragraphs.
const HELP: Record<Lang, { heading: string; close: string; topics: Topic[] }> = {
  en: {
    heading: 'How to use Kadai',
    close: 'Close',
    topics: [
      {
        title: 'Make a bill by voice',
        body: 'On the Sell screen tap "Speak the items" and say the order, for example "two kilo rice, one Colgate, half kilo sugar". You can speak in Tamil, English or both. Check the cart, then take payment. A spoken price such as "rice 60 rupees" helps pick the right product.',
      },
      {
        title: 'Add stock and expiry dates',
        body: 'Open a product and choose Add stock. Enter the quantity and the expiry date of that batch. Each batch keeps its own date, so a new delivery does not hide an older one. At billing, Kadai tells you which batch to sell first.',
      },
      {
        title: 'Sell the oldest first',
        body: 'When a batch is close to expiring, the Sell screen shows a hint to sell it first and offers a one-tap markdown. Home and the product list show only what is really on your shelf.',
      },
      {
        title: 'Credit (udhaar)',
        body: 'Choose Credit when taking payment and pick the customer. Open Customers from Settings to see who owes you, and record a payment when they pay back.',
      },
      {
        title: 'Check your UPI money',
        body: 'Settings, then UPI. Copy the payment SMS or the PhonePe, GPay or Paytm notification and paste it with "Paste payment messages". Kadai records money received and matches it to your UPI bills. Bills with no matching money are shown in red so you can check them. Kadai never reads your messages by itself.',
      },
      {
        title: 'Works without internet',
        body: 'Billing, stock and voice work offline. Everything saves on your phone and syncs by itself when the internet is back. Keep the app updated on every phone that uses the same shop.',
      },
      {
        title: 'Reports and your accountant',
        body: 'Reports shows sales and profit. Accountant export makes a file your accountant can open. Figures come from your own entries and are not a tax filing.',
      },
      {
        title: 'Language',
        body: 'Change between Tamil and English any time from the language button on the home screen.',
      },
    ],
  },
  ta: {
    heading: 'கடை பயன்படுத்துவது எப்படி',
    close: 'மூடு',
    topics: [
      {
        title: 'குரலில் பில் போடுங்கள்',
        body: 'விற்பனை திரையில் "பொருட்களைச் சொல்லுங்கள்" அழுத்தி, எடுத்துக்காட்டாக "இரண்டு கிலோ அரிசி, ஒரு கோல்கேட், அரை கிலோ சர்க்கரை" என்று சொல்லுங்கள். தமிழ், ஆங்கிலம் அல்லது இரண்டும் கலந்தும் சொல்லலாம். கூடையைச் சரிபார்த்து பணம் வாங்குங்கள். "அரிசி அறுபது ரூபாய்" என்று விலையைச் சொன்னால் சரியான பொருளைத் தேர்வு செய்ய உதவும்.',
      },
      {
        title: 'சரக்கு மற்றும் காலாவதி தேதி சேர்க்க',
        body: 'ஒரு பொருளைத் திறந்து சரக்கு சேர் என்பதைத் தேர்ந்தெடுங்கள். எண்ணிக்கையும் அந்த தொகுதியின் காலாவதி தேதியும் உள்ளிடுங்கள். ஒவ்வொரு தொகுதிக்கும் தனி தேதி இருக்கும்; புதிய சரக்கு வந்தால் பழைய தேதி மறையாது. பில் போடும்போது எதை முதலில் விற்பது என்று கடை காட்டும்.',
      },
      {
        title: 'பழையதை முதலில் விற்கவும்',
        body: 'ஒரு தொகுதி விரைவில் காலாவதியாகும் என்றால், விற்பனை திரை முதலில் அதை விற்கச் சொல்லும்; ஒரே தொடுதலில் விலைக் குறைப்பும் செய்யலாம். முகப்பு மற்றும் பொருள் பட்டியல் உண்மையில் அலமாரியில் உள்ளதை மட்டுமே காட்டும்.',
      },
      {
        title: 'கடன் (உதார்)',
        body: 'பணம் வாங்கும்போது கடன் என்பதைத் தேர்ந்தெடுத்து வாடிக்கையாளரைத் தேர்வு செய்யுங்கள். அமைப்புகளில் வாடிக்கையாளர்கள் பகுதியில் யார் எவ்வளவு தர வேண்டும் என்று பார்க்கலாம்; திருப்பிக் கொடுக்கும்போது பதிவு செய்யுங்கள்.',
      },
      {
        title: 'UPI பணத்தைச் சரிபார்க்க',
        body: 'அமைப்புகள், பிறகு UPI. பணம் வந்த SMS அல்லது PhonePe, GPay, Paytm அறிவிப்பை நகலெடுத்து "பணம் வந்த செய்திகளை ஒட்டவும்" மூலம் ஒட்டுங்கள். வந்த பணத்தை கடை பதிவு செய்து உங்கள் UPI பில்களுடன் பொருத்தும். பணம் பொருந்தாத பில்கள் சிவப்பில் காட்டப்படும். உங்கள் செய்திகளை கடை தானாகப் படிக்காது.',
      },
      {
        title: 'இணையம் இல்லாமலும் வேலை செய்யும்',
        body: 'பில், சரக்கு, குரல் ஆகியவை இணையம் இல்லாமலும் வேலை செய்யும். அனைத்தும் உங்கள் போனில் சேமிக்கப்பட்டு, இணையம் வந்ததும் தானாக ஒத்திசைக்கும். ஒரே கடையைப் பயன்படுத்தும் அனைத்து போன்களிலும் செயலியைப் புதுப்பித்து வைத்திருங்கள்.',
      },
      {
        title: 'அறிக்கைகள் மற்றும் கணக்காளர்',
        body: 'அறிக்கைகள் விற்பனை மற்றும் லாபத்தைக் காட்டும். கணக்காளர் ஏற்றுமதி உங்கள் கணக்காளர் திறக்கக்கூடிய கோப்பை உருவாக்கும். எண்கள் நீங்கள் பதிவு செய்தவையே; இது வரி தாக்கல் அல்ல.',
      },
      {
        title: 'மொழி',
        body: 'முகப்புத் திரையில் உள்ள மொழி பொத்தானால் தமிழ் / ஆங்கிலம் எப்போது வேண்டுமானாலும் மாற்றலாம்.',
      },
    ],
  },
};

export default function HelpSheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const h = HELP[lang];
  return (
    <div className={`${SHEET_OVERLAY} z-40`}>
      <div
        className={`${SHEET_PANEL} max-h-[92vh] space-y-4 overflow-y-auto md:max-w-2xl`}
        style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{h.heading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            {h.close}
          </button>
        </div>
        {h.topics.map((tp) => (
          <section key={tp.title} className="space-y-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-50">{tp.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{tp.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
