export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (!from || !to || from === to) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return 1;
    const data = await res.json();
    return data.rates[to] || 1;
  } catch (err) {
    console.error('FX Fetch error:', err);
    return 1;
  }
}