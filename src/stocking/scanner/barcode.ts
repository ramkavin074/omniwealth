// Barcode input with two backends:
//   - Native (Capacitor + @capacitor-mlkit/barcode-scanning): full-screen
//     ML Kit camera scanner. No extra hardware.
//   - Web / dev: a plain prompt() so every screen is testable in a browser
//     without the native layer.
//
// The plugin is imported dynamically so the web bundle never pulls in native
// code it can't run.

export type ScanResult =
  | { ok: true; barcode: string }
  | { ok: false; reason: 'cancelled' | 'permission' | 'unsupported' | 'error' };

function isNative(): boolean {
  try {
    // Avoid a hard dependency on @capacitor/core in pure-web builds.
    const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** True when the device can run the ML Kit scanner. */
export async function isNativeScanAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const mod = await import('@capacitor-mlkit/barcode-scanning');
    const { supported } = await mod.BarcodeScanner.isSupported();
    return supported;
  } catch {
    return false;
  }
}

async function ensurePermission(): Promise<boolean> {
  const mod = await import('@capacitor-mlkit/barcode-scanning');
  const current = await mod.BarcodeScanner.checkPermissions();
  if (current.camera === 'granted' || current.camera === 'limited') return true;
  const asked = await mod.BarcodeScanner.requestPermissions();
  return asked.camera === 'granted' || asked.camera === 'limited';
}

async function ensureModule(): Promise<void> {
  // On Android the ML Kit scanner model may be delivered as an on-demand
  // Google Play module. Install it once if it isn't there yet.
  try {
    const mod = await import('@capacitor-mlkit/barcode-scanning');
    const { available } =
      await mod.BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await mod.BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  } catch {
    // Not all platforms expose this; scanning may still work.
  }
}

function promptFallback(message: string): ScanResult {
  if (typeof window === 'undefined' || !window.prompt) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    // Some embedded WebViews throw here instead of returning null.
    const value = window.prompt(message)?.trim();
    if (!value) return { ok: false, reason: 'cancelled' };
    return { ok: true, barcode: value };
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
}

/** Scan a barcode. `manualPrompt` is the message shown by the web fallback. */
export async function scanBarcode(manualPrompt: string): Promise<ScanResult> {
  if (!(await isNativeScanAvailable())) {
    return promptFallback(manualPrompt);
  }

  try {
    if (!(await ensurePermission())) {
      return { ok: false, reason: 'permission' };
    }
    await ensureModule();

    const mod = await import('@capacitor-mlkit/barcode-scanning');
    const { barcodes } = await mod.BarcodeScanner.scan();
    const value = barcodes[0]?.rawValue?.trim();
    if (!value) return { ok: false, reason: 'cancelled' };
    return { ok: true, barcode: value };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
