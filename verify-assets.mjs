#!/usr/bin/env node
/**
 * verify-assets.mjs
 *
 * Checks the Inspire Business Web build for two things:
 *   1. Frame count in each scrub sequence matches what you expect.
 *   2. Every referenced frame/portfolio image actually returns 200
 *      from the running dev server (catches silent 404s mid-scrub).
 *
 * Usage:
 *   node verify-assets.mjs
 *
 * Run this from the project's `site/` directory (or edit ROOT below),
 * with `npm run dev` already running at BASE_URL.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

// ---- config: adjust to match your project ----------------------------
const ROOT = process.cwd(); // expects to be run from site/
const BASE_URL = "http://localhost:5183";

const FRAME_SETS = [
  { name: "morph", dir: "public/frames/morph", expectedCount: 150 },
  { name: "flythrough", dir: "public/frames/flythrough", expectedCount: 150 },
];

const STATIC_IMAGES = [
  "/images/forge.jpg",
  "/images/fluyo.jpg",
  "/images/smart-home.jpg",
];
// ------------------------------------------------------------------------

const results = { frameCounts: [], badAssets: [], okCount: 0 };

async function listFrameFiles(dir) {
  const full = path.join(ROOT, dir);
  try {
    const entries = await readdir(full);
    return entries
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();
  } catch (err) {
    return null; // directory missing
  }
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  console.log(`\nChecking against ${BASE_URL}\n${"=".repeat(50)}`);

  // 1. Frame counts on disk
  for (const set of FRAME_SETS) {
    const files = await listFrameFiles(set.dir);
    if (files === null) {
      results.frameCounts.push({
        name: set.name,
        status: "MISSING_DIR",
        dir: set.dir,
      });
      console.log(`✗ ${set.name}: directory not found (${set.dir})`);
      continue;
    }
    const match = files.length === set.expectedCount;
    results.frameCounts.push({
      name: set.name,
      found: files.length,
      expected: set.expectedCount,
      match,
    });
    console.log(
      `${match ? "✓" : "✗"} ${set.name}: found ${files.length} frames (expected ${set.expectedCount})`
    );

    // 2. Spot-check every frame in this set resolves over HTTP
    for (const file of files) {
      const url = `${BASE_URL}/${set.dir.replace(/^public\//, "")}/${file}`;
      const status = await checkUrl(url);
      if (status !== 200) {
        results.badAssets.push({ url, status });
        console.log(`  ✗ ${url} -> ${status}`);
      } else {
        results.okCount++;
      }
    }
  }

  // 3. Static portfolio/hero images
  console.log(`\nChecking static images...`);
  for (const imgPath of STATIC_IMAGES) {
    const url = `${BASE_URL}${imgPath}`;
    const status = await checkUrl(url);
    if (status !== 200) {
      results.badAssets.push({ url, status });
      console.log(`✗ ${url} -> ${status}`);
    } else {
      console.log(`✓ ${url} -> 200`);
      results.okCount++;
    }
  }

  // ---- summary ----
  console.log(`\n${"=".repeat(50)}`);
  console.log(`SUMMARY`);
  console.log(`${"=".repeat(50)}`);

  const countMismatches = results.frameCounts.filter(
    (f) => f.status === "MISSING_DIR" || f.match === false
  );
  if (countMismatches.length) {
    console.log(`\nFrame count issues:`);
    countMismatches.forEach((f) =>
      console.log(
        f.status === "MISSING_DIR"
          ? `  - ${f.name}: directory missing (${f.dir})`
          : `  - ${f.name}: ${f.found} found vs ${f.expected} expected`
      )
    );
  } else {
    console.log(`\nFrame counts: all sets match expected counts.`);
  }

  if (results.badAssets.length) {
    console.log(`\n${results.badAssets.length} broken asset(s):`);
    results.badAssets.forEach((a) => console.log(`  - ${a.url} -> ${a.status}`));
  } else {
    console.log(`\nAll ${results.okCount} checked assets returned 200.`);
  }

  const clean = countMismatches.length === 0 && results.badAssets.length === 0;
  console.log(`\n${clean ? "✓ PASS" : "✗ FAIL"} — ${clean ? "ready for the next check" : "fix the above before shipping"}\n`);

  process.exit(clean ? 0 : 1);
}

main();
