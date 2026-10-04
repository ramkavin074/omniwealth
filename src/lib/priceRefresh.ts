// Live price refresh for holdings that have a ticker (crypto via CoinGecko,
// Indian mutual funds via mfapi.in, everything else via Yahoo Finance).
// Shared by the "Refresh prices" button and the daily cron, so both behave
// identically. Not a server action: only callers that have already checked
// who is asking may use it.

import { db } from '@/db';
import { assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toNumeric } from '@/lib/num';

type AssetRow = typeof assets.$inferSelect;

/** Updates each priced holding's value; returns how many were updated. */
export async function refreshAssetPrices(householdAssets: AssetRow[], deadline = Infinity): Promise<number> {
  let updatedCount = 0;
  const fiatTickers = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY', 'USDT_FIAT'];
  // Every currency CoinGecko's simple/price endpoint is queried in below —
  // matches the household currency list used throughout the app.
  const SUPPORTED_VS_CURRENCIES = new Set(['usd', 'eur', 'gbp', 'cad', 'aud', 'inr', 'jpy', 'chf', 'cny']);

  const priceCache = new Map<string, number | null>();

  for (const asset of householdAssets) {
    if (Date.now() > deadline) break;
    const assetType = (asset.assetType || '').toUpperCase().trim();
    const ticker = (asset.ticker || '').toUpperCase().trim();

    if (!ticker || assetType === 'CASH' || fiatTickers.includes(ticker)) {
      continue;
    }

    let livePrice: number | null = null;

    try {
      // One quote per distinct (type, ticker, currency) per run, however many
      // holdings share it.
      const cacheKey = `${assetType}|${ticker}|${asset.nativeCurrency || ''}`;
      if (priceCache.has(cacheKey)) {
        livePrice = priceCache.get(cacheKey) ?? null;
      } else {
      if (assetType === 'CRYPTO' || ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP'].includes(ticker)) {
        // Explicit ticker -> CoinGecko id. Never fall back to a guessed
        // lowercase id: "doge" is a junk token, not Dogecoin, and a wrong
        // hit silently overwrites the holding's value.
        const coinMap: { [key: string]: string } = {
          BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
          XRP: 'ripple', DOGE: 'dogecoin', SHIB: 'shiba-inu', PEPE: 'pepe',
          AAVE: 'aave', BNB: 'binancecoin', USDT: 'tether', USDC: 'usd-coin',
          DOT: 'polkadot', LTC: 'litecoin', LINK: 'chainlink', TRX: 'tron',
          AVAX: 'avalanche-2', BCH: 'bitcoin-cash', XLM: 'stellar', MATIC: 'matic-network',
        };
        const coinId = coinMap[ticker];
        if (coinId) {
          // Ask CoinGecko for the price in the holding's own currency — it
          // was previously hardcoded to USD, so a crypto holding valued in
          // any other currency (INR, GBP, ...) got the raw USD number
          // written in as if it were that currency, understating it by
          // roughly the USD exchange rate.
          const vsCurrency = SUPPORTED_VS_CURRENCIES.has((asset.nativeCurrency || '').toLowerCase())
            ? asset.nativeCurrency.toLowerCase()
            : 'usd';
          const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`, { next: { revalidate: 60 } });
          const data = await res.json();
          livePrice = data[coinId]?.[vsCurrency] || null;
        }
      } else if (assetType === 'MUTUAL_FUND') {
        // Indian mutual funds: NAV by AMFI scheme code via mfapi.in (a free
        // wrapper over AMFI's daily NAV feed — no API key). The "ticker"
        // field holds the scheme code, e.g. 120503. NAV is published once a
        // day, so this is cached longer than the intraday stock/crypto quotes.
        const schemeCode = ticker.replace(/\D/g, '');
        if (schemeCode) {
          const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, { next: { revalidate: 3600 } });
          const data = await res.json();
          const nav = data?.data?.[0]?.nav;
          livePrice = nav ? parseFloat(nav) : null;
        }
      } else {
        // Works for any exchange Yahoo covers by ticker suffix, e.g.
        // RELIANCE.NS/.BO (India), .L (London), .TO (Toronto), .AX (Sydney),
        // .T (Tokyo), .SW (Switzerland), .DE/.PA/.MI/.AS (EU), .SS/.SZ (China A-shares).
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 60 }
        });
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        livePrice = meta?.regularMarketPrice || null;
        // London Stock Exchange quotes in pence, not pounds — Yahoo flags
        // this with currency "GBp" (lowercase p). Left unconverted, a
        // holding priced in GBP would be overstated 100x.
        if (livePrice !== null && meta?.currency === 'GBp') {
          livePrice = livePrice / 100;
        }
      }

        priceCache.set(cacheKey, livePrice);
      }

      if (livePrice !== null && livePrice > 0) {
        const qty = parseFloat(asset.quantity && asset.quantity.trim() !== '' ? asset.quantity : '1') || 1;
        const newTotalValue = toNumeric(qty * livePrice, '0');

        await db.update(assets)
          .set({ nativeValue: newTotalValue, updatedAt: new Date() })
          .where(eq(assets.id, asset.id));

        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to fetch live price for ticker ${ticker}:`, err);
    }
  }

  return updatedCount;
}
