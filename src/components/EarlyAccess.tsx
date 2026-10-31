// The "early access" block shown on a product page while its Android app is in Google Play closed testing (a testing link only works for
// people who have been added to the test, so the page asks for the Google account first) and its iPhone app is not out yet.
export default function EarlyAccess({
  app,
  testUrl,
  requestHref,
}: {
  app: string;
  testUrl: string;
  requestHref: string;
}) {
  return (
    <section id="early" className="scroll-mt-6 border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-extrabold text-slate-900">Early access</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          The {app} Android app is in closed testing on Google Play. The iPhone app is coming soon to the App Store.
        </p>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ['Ask to be added', 'Send us the email address of the Google account you use on your Android phone.'],
            ['We add you to the test', 'We will reply when you are on the list. Only people on the list can join.'],
            ['Join and install', 'Open the join link below on your phone, accept, and install the app from Google Play.'],
          ].map(([t, b], i) => (
            <li key={t} className="rounded-2xl bg-white p-5 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-bold text-slate-900">{t}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{b}</p>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href={requestHref} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-600">
            Ask to join the Android test
          </a>
          <a
            href={testUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
          >
            I am already on the list: join the test
          </a>
          <span className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-600">iPhone: coming soon to the App Store</span>
        </div>
      </div>
    </section>
  );
}
