// Mirror the Vercel Blob store (uploaded documents) into S3-compatible
// storage, GPG-encrypted. Run by .github/workflows/backup.yml.
//
// Env: BLOB_READ_WRITE_TOKEN, BACKUP_GPG_PASSPHRASE, S3_ENDPOINT, S3_BUCKET,
//      AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION.
//
// Each object is stored once per day under blob/YYYY-MM-DD/<pathname>.gpg.
// Re-running the same day overwrites; older days are kept for point-in-time
// history (set a bucket lifecycle rule to expire the prefix).

import { list } from '@vercel/blob';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  BACKUP_GPG_PASSPHRASE,
  S3_ENDPOINT,
  S3_BUCKET,
} = process.env;

if (!BACKUP_GPG_PASSPHRASE || !S3_ENDPOINT || !S3_BUCKET) {
  console.error('Missing required env (passphrase / S3_ENDPOINT / S3_BUCKET)');
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
const work = mkdtempSync(join(tmpdir(), 'blobbak-'));
let cursor;
let count = 0;
let bytes = 0;

try {
  do {
    const page = await list({ cursor, limit: 1000 });
    for (const b of page.blobs) {
      const res = await fetch(b.downloadUrl ?? b.url);
      if (!res.ok) {
        console.error(`skip ${b.pathname}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const plain = join(work, 'obj');
      writeFileSync(plain, buf);
      const enc = `${plain}.gpg`;
      execFileSync('gpg', [
        '--batch', '--yes', '--pinentry-mode', 'loopback',
        '--passphrase', BACKUP_GPG_PASSPHRASE,
        '--symmetric', '--cipher-algo', 'AES256',
        '-o', enc, plain,
      ]);
      const key = `blob/${day}/${b.pathname}.gpg`;
      execFileSync('aws', [
        '--endpoint-url', S3_ENDPOINT,
        's3', 'cp', enc, `s3://${S3_BUCKET}/${key}`, '--no-progress',
      ]);
      count += 1;
      bytes += buf.length;
      rmSync(plain, { force: true });
      rmSync(enc, { force: true });
    }
    cursor = page.cursor;
  } while (cursor);
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(`Backed up ${count} blob objects (${(bytes / 1e6).toFixed(1)} MB) to blob/${day}/`);
