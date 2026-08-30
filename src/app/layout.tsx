import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PortfolioAIChat from "@/components/PortfolioAIChat";
import { getSessionUserAction } from "@/actions/vault";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniWealth | Global Family Vault",
  description: "Global Family Wealth Command Center",
  manifest: "/manifest.json",
  icons: {
    icon: { url: "/omniwealth.jpg", type: "image/jpeg" },
    apple: { url: "/omniwealth.jpg", type: "image/jpeg" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OmniWealth",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4f46e5",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionUserAction();
  const themePreference = session?.user?.themePreference || "light";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        themePreference === "dark" ? "dark" : ""
      }`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const persistedTheme = localStorage.getItem('theme');
                if (persistedTheme === 'dark' || (!persistedTheme && '${themePreference}' === 'dark')) {
                  document.documentElement.classList.add('dark');
                } else if (persistedTheme === 'light' || (!persistedTheme && '${themePreference}' === 'light')) {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-teal-600 selection:text-white transition-colors">
        {children}
        <PortfolioAIChat />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}