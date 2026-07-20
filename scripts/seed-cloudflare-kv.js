#!/usr/bin/env node
'use strict';

/**
 * Seeds Cloudflare KV with initial JSON data from /data.
 * Run after creating KV namespace:
 *   npx wrangler kv namespace create ELTEX_DATA
 *   Update wrangler.toml with the namespace id
 *   node scripts/seed-cloudflare-kv.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NS = process.env.KV_NAMESPACE_ID;

if (!NS) {
  console.error('Set KV_NAMESPACE_ID env var (from wrangler.toml after creating namespace)');
  process.exit(1);
}

const files = [
  ['live-products', 'data/live-products.json'],
  ['live-posts', 'data/live-posts.json'],
  ['live-orders', 'data/live-orders.json'],
];

for (const [key, rel] of files) {
  const filePath = path.join(ROOT, rel);
  const json = fs.readFileSync(filePath, 'utf8');
  JSON.parse(json);
  execSync(`npx wrangler kv key put --namespace-id=${NS} ${key} --path=${filePath}`, {
    stdio: 'inherit',
    cwd: ROOT,
  });
  console.log('Seeded', key);
}

console.log('Done. KV is ready for Cloudflare Pages.');
