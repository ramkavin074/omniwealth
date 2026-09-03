// Direct thermal printing over Bluetooth LE, for the installed Android app.
//
//  - `pairPrinter()` opens the OS device picker and remembers the choice.
//  - `printReceiptSmart()` sends ESC/POS bytes straight to that printer; with
//    no printer paired (or on the web build) it falls back to the HTML print
//    dialog in `./print`.
//
// The BLE plugin is imported dynamically and only ever touched on a native
// platform, so the web bundle never runs it — mirrors `scanner/barcode.ts`.

import { escposReceipt, printReceipt } from './print';
import type { Lang } from './i18n';
import type { GstConfig, Sale } from './types';
import type { ReceiptConfig } from './settings';

interface PrintOpts {
  lang: Lang;
  gst: Pick<GstConfig, 'gstin'>;
  receipt: ReceiptConfig;
}

const KEY = 'stocking.printer';

// Write characteristics common to cheap 58/80mm BLE thermal printers, tried
// in order when a saved printer has no remembered characteristic yet.
const KNOWN_WRITE: { service: string; characteristic: string }[] = [
  {
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
  {
    service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
  {
    service: '0000ff00-0000-1000-8000-00805f9b34fb',
    characteristic: '0000ff02-0000-1000-8000-00805f9b34fb',
  },
  {
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    characteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  },
];
const ALL_OPTIONAL_SERVICES = KNOWN_WRITE.map((k) => k.service);

export interface SavedPrinter {
  deviceId: string;
  name: string;
  /** Learned after the first successful print — skips rediscovery. */
  service?: string;
  characteristic?: string;
  /** true = the char only supports write-with-response. */
  ackWrites?: boolean;
}

export function getPrinter(): SavedPrinter | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SavedPrinter>;
    return p.deviceId ? (p as SavedPrinter) : null;
  } catch {
    return null;
  }
}

function savePrinter(p: SavedPrinter): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function forgetPrinter(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function isNative(): boolean {
  try {
    const cap = (
      globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** True when this build can talk to a BLE printer at all (the installed app). */
export function isBlePrintingAvailable(): boolean {
  return isNative();
}

type BleModule = typeof import('@capacitor-community/bluetooth-le');

let bleReady: Promise<BleModule['BleClient']> | null = null;
async function ble(): Promise<BleModule['BleClient']> {
  if (!bleReady) {
    bleReady = (async () => {
      const mod = await import('@capacitor-community/bluetooth-le');
      await mod.BleClient.initialize({ androidNeverForLocation: true });
      return mod.BleClient;
    })();
  }
  return bleReady;
}

export type PairResult =
  | { ok: true; printer: SavedPrinter }
  | { ok: false; reason: 'unsupported' | 'cancelled' | 'error' };

/** Open the OS Bluetooth picker and remember the chosen device. */
export async function pairPrinter(): Promise<PairResult> {
  if (!isNative()) return { ok: false, reason: 'unsupported' };
  try {
    const client = await ble();
    const device = await client.requestDevice({
      optionalServices: ALL_OPTIONAL_SERVICES,
    });
    const printer: SavedPrinter = {
      deviceId: device.deviceId,
      name: device.name?.trim() || 'Printer',
    };
    savePrinter(printer);
    return { ok: true, printer };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes('cancel') || msg.includes('no device')) {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'error' };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk(bytes: Uint8Array, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size));
  return out;
}

/** Find a writable service/characteristic on a connected device. */
async function discoverWrite(
  client: BleModule['BleClient'],
  deviceId: string,
): Promise<{ service: string; characteristic: string; ackWrites: boolean } | null> {
  try {
    const services = await client.getServices(deviceId);
    for (const known of KNOWN_WRITE) {
      const svc = services.find(
        (s) => s.uuid.toLowerCase() === known.service.toLowerCase(),
      );
      const ch = svc?.characteristics.find(
        (c) => c.uuid.toLowerCase() === known.characteristic.toLowerCase(),
      );
      if (ch) {
        return {
          service: svc!.uuid,
          characteristic: ch.uuid,
          ackWrites: !ch.properties.writeWithoutResponse,
        };
      }
    }
    // Nothing known — take the first characteristic that can be written.
    for (const s of services) {
      for (const c of s.characteristics) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          return {
            service: s.uuid,
            characteristic: c.uuid,
            ackWrites: !c.properties.writeWithoutResponse,
          };
        }
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

export type PrintResult =
  | { ok: true; via: 'bluetooth' | 'dialog' }
  | { ok: false; reason: 'no-printer' | 'error' };

/** Send raw ESC/POS bytes to the paired BLE printer. */
export async function printBytes(bytes: Uint8Array): Promise<PrintResult> {
  const printer = getPrinter();
  if (!isNative() || !printer) return { ok: false, reason: 'no-printer' };

  let client: BleModule['BleClient'];
  try {
    client = await ble();
  } catch {
    return { ok: false, reason: 'error' };
  }

  try {
    await client.connect(printer.deviceId);

    const route =
      printer.service && printer.characteristic
        ? {
            service: printer.service,
            characteristic: printer.characteristic,
            ackWrites: !!printer.ackWrites,
          }
        : await discoverWrite(client, printer.deviceId);

    if (!route) {
      await client.disconnect(printer.deviceId).catch(() => {});
      return { ok: false, reason: 'error' };
    }

    if (route.service !== printer.service || route.characteristic !== printer.characteristic) {
      savePrinter({
        ...printer,
        service: route.service,
        characteristic: route.characteristic,
        ackWrites: route.ackWrites,
      });
    }

    // BLE MTU is small; 180-byte frames with a short gap keep the printer's
    // buffer from overflowing on long receipts.
    for (const part of chunk(bytes, 180)) {
      const view = new DataView(
        part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength),
      );
      if (route.ackWrites) {
        await client.write(printer.deviceId, route.service, route.characteristic, view);
      } else {
        await client.writeWithoutResponse(
          printer.deviceId,
          route.service,
          route.characteristic,
          view,
        );
      }
      await sleep(20);
    }
    await sleep(120);
    await client.disconnect(printer.deviceId).catch(() => {});
    return { ok: true, via: 'bluetooth' };
  } catch {
    await client.disconnect(printer.deviceId).catch(() => {});
    return { ok: false, reason: 'error' };
  }
}

/** Print a receipt the best way available: a paired BLE printer if there is
 *  one, otherwise the OS print dialog. Falls back to the dialog if the
 *  Bluetooth write fails. */
export async function printReceiptSmart(
  sale: Sale,
  opts: PrintOpts,
): Promise<PrintResult> {
  if (isNative() && getPrinter()) {
    const r = await printBytes(escposReceipt(sale, opts));
    if (r.ok) return r;
  }
  printReceipt(sale, opts);
  return { ok: true, via: 'dialog' };
}

/** A tiny "hello" slip to confirm a freshly paired printer works. */
export async function testPrint(receipt: ReceiptConfig): Promise<PrintResult> {
  const ESC = 0x1b;
  const GS = 0x1d;
  const enc = (s: string) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
  const bytes = new Uint8Array([
    ESC, 0x40,
    ESC, 0x61, 0x01,
    ...enc((receipt.shopName || 'OmniWealth Kadai') + '\n'),
    ...enc('printer test ok\n'),
    ...enc(new Date().toLocaleString('en-IN') + '\n'),
    0x0a, 0x0a, 0x0a,
    GS, 0x56, 0x00,
  ]);
  return printBytes(bytes);
}
