#!/usr/bin/env node
// Generates skeleton fields for all blocks in blocks/.
// Skeleton = nested mirror of tree with short-phrase labels at _.
// Mechanical extraction: first ~5 words of _ text.
// Hand-tune key blocks afterward.

const fs = require('fs');
const path = require('path');

const blocksDir = path.join(__dirname, 'blocks');

function extractLabel(text, maxWords = 5) {
  if (!text || typeof text !== 'string') return null;
  // Strip leading status markers (DONE, ACTIVE, NEXT, LATER with optional — or :)
  const cleaned = text.replace(/^(DONE|ACTIVE|NEXT|LATER)\s*[—:\-]\s*/i, '');
  const words = cleaned.split(/\s+/).slice(0, maxWords);
  let label = words.join(' ');
  // Remove trailing punctuation that looks awkward in a label
  label = label.replace(/[.,:;—]+$/, '');
  // Truncate if still too long
  if (label.length > 50) label = label.slice(0, 47) + '...';
  return label;
}

function buildSkeleton(node) {
  if (typeof node === 'string') {
    return extractLabel(node);
  }
  if (!node || typeof node !== 'object') return null;

  const skeleton = {};
  if (node._) {
    skeleton._ = extractLabel(node._);
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === '_') continue;
    // Skip non-digit keys (metadata like last, spine, stimulus, focus, etc.)
    if (!/^\d$/.test(k)) continue;
    const child = buildSkeleton(v);
    if (child !== null) skeleton[k] = child;
  }
  // If skeleton only has _ and nothing else, return just the label string
  const keys = Object.keys(skeleton);
  if (keys.length === 1 && keys[0] === '_') return skeleton._;
  return Object.keys(skeleton).length > 0 ? skeleton : null;
}

const files = fs.readdirSync(blocksDir)
  .filter(f => f.endsWith('.json'))
  .sort();

let updated = 0;

for (const file of files) {
  const filePath = path.join(blocksDir, file);
  const block = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!block.tree) continue;

  const skeleton = buildSkeleton(block.tree);
  if (!skeleton) continue;

  block.skeleton = skeleton;
  block.skeleton_at = Math.floor(Date.now() / 1000);

  fs.writeFileSync(filePath, JSON.stringify(block, null, 2) + '\n');
  updated++;
  console.log(`  ${file.replace('.json', '')}: skeleton generated`);
}

console.log(`\nSkeletons generated for ${updated} blocks.`);
