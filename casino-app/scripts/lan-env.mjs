#!/usr/bin/env node
// Rewrite .env.local so EXPO_PUBLIC_CONVEX_URL + EXPO_PUBLIC_CONVEX_SITE_URL
// point at the host's LAN IP. Lets simulators AND real devices on the same
// Wi-Fi reach the local Convex backend (which already binds 0.0.0.0).
//
// Usage:
//   node scripts/lan-env.mjs            → use the host's first non-internal IPv4
//   node scripts/lan-env.mjs --localhost → revert to 127.0.0.1
//   node scripts/lan-env.mjs --ip 10.0.0.5 → force a specific IP
//
// After running, restart Metro (or reload the bundle) so the new env is
// inlined into the JS.
//
// Idempotent: safe to re-run when you join a new Wi-Fi network.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = resolve(__dirname, '..', '.env.local');

function pickLanIp() {
  // Prefer the IP the OS routes 8.8.8.8 over (handles multi-NIC laptops).
  try {
    const out = execSync(
      'ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null'
    )
      .toString()
      .trim();
    if (out && /^\d+\.\d+\.\d+\.\d+$/.test(out)) return out;
  } catch {
    // fall through
  }
  // Fallback: scan os.networkInterfaces().
  const ifs = networkInterfaces();
  for (const [name, addrs] of Object.entries(ifs)) {
    for (const a of addrs ?? []) {
      if (
        a.family === 'IPv4' &&
        !a.internal &&
        !name.startsWith('lo') &&
        !a.address.startsWith('169.254')
      ) {
        return a.address;
      }
    }
  }
  throw new Error('No LAN IPv4 address found.');
}

function parseArgs(argv) {
  const out = { mode: 'lan', ip: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--localhost') out.mode = 'localhost';
    else if (a === '--ip' && argv[i + 1]) {
      out.ip = argv[i + 1];
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const target =
  args.mode === 'localhost' ? '127.0.0.1' : args.ip ?? pickLanIp();

const original = readFileSync(ENV_PATH, 'utf8');
const lines = original.split(/\r?\n/);

const replace = (key, value) => {
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
};

replace('EXPO_PUBLIC_CONVEX_URL', `http://${target}:3210`);
replace('EXPO_PUBLIC_CONVEX_SITE_URL', `http://${target}:3211`);

const next = lines.join('\n');
if (next === original) {
  console.log(`.env.local already targets ${target}; no changes.`);
  process.exit(0);
}
writeFileSync(ENV_PATH, next);
console.log(`Pointed Convex URLs at ${target}.`);
console.log('Restart Metro (Ctrl-C → `bun run start:dev-client`) so the new');
console.log('env is inlined into the JS bundle.');
