// bsp.js — Block · Spindle · Point
// Semantic address resolver for pscale JSON blocks.
// Extracted from current g1/kernel.js — the definitive implementation.
// Includes tuning fork compensation, spread/tree modes, delineation handling.

// ============ BLOCK NAVIGATION ============

function blockNavigate(block, path) {
  if (!path) return block.tree;
  const keys = path.split('.');
  let node = block.tree;
  for (const k of keys) {
    if (node === null || node === undefined) return null;
    if (typeof node === 'string') return null;
    node = node[k];
  }
  return node;
}

function xSpread(block, path) {
  const node = path ? blockNavigate(block, path) : block.tree;
  if (node === null || node === undefined) return null;
  if (typeof node === 'string') return { text: node, children: [] };
  const text = node._ || null;
  const children = [];
  for (const [k, v] of Object.entries(node)) {
    if (k === '_') continue;
    const childText = typeof v === 'string' ? v : (v && typeof v === 'object' && v._) ? v._ : null;
    children.push({ digit: k, text: childText, branch: typeof v === 'object' && v !== null });
  }
  return { text, children };
}

function resolveBlock(block, maxDepth) {
  maxDepth = maxDepth || 3;
  function walk(node, depth, path) {
    if (depth > maxDepth) return null;
    if (typeof node === 'string') return { path, text: node };
    if (!node) return null;
    const result = { path, text: node._ || null, children: [] };
    for (const [k, v] of Object.entries(node)) {
      if (k === '_') continue;
      const childPath = path ? `${path}.${k}` : k;
      const child = walk(v, depth + 1, childPath);
      if (child) result.children.push(child);
    }
    return result;
  }
  return walk(block.tree, 0, '');
}

// ============ TUNING FORK ============

function getTuningDecimalPosition(blk) {
  if (!blk || !blk.tuning) return null;
  const parts = String(blk.tuning).split('.');
  const intStr = parts[0] || '0';
  return intStr === '0' ? 0 : intStr.length;
}

function getCompressionDepth(tree) {
  let depth = 0;
  let node = tree;
  while (node && typeof node === 'object' && node['0'] !== undefined) {
    depth++;
    node = node['0'];
  }
  return depth;
}

// ============ BSP — Block · Spindle · Point ============
// bsp(block)               → full block tree
// bsp(block, spindle)      → chain of semantics, one per digit, high pscale to low
// bsp(block, spindle, ps)  → single semantic at the specified pscale level
// bsp(block, spindle, '~') → spread (X~): node text + immediate children
// bsp(block, spindle, '*') → tree: full recursive subtree from endpoint

let __blockLoader = null;

function bspRegister(loader) {
  __blockLoader = loader;
}

function bsp(block, spindle, point) {
  const blk = typeof block === 'string'
    ? (__blockLoader ? __blockLoader(block) : null)
    : block;
  if (!blk || !blk.tree) return { mode: 'block', tree: {} };

  // Block mode — no spindle, return full tree (unless point is a nav mode)
  if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
    return { mode: 'block', tree: blk.tree };
  }

  // Parse the semantic number (or default to root for no-spindle nav modes)
  let walkDigits, hasPscale, digitsBefore;
  if (spindle === undefined || spindle === null) {
    walkDigits = [];
    hasPscale = true;
    digitsBefore = 0;
  } else {
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const intStr = parts[0] || '0';
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    // Delineation: integer part is "0" — strip it, walk only fractional digits
    const isDelineation = intStr === '0';
    walkDigits = isDelineation
      ? fracStr.split('').filter(c => c.length > 0)
      : (intStr + fracStr).split('');
    // Pscale from decimal position — tuning fork overrides when present
    hasPscale = isDelineation || fracStr.length > 0;
    const spindleTreeDepth = isDelineation ? 0 : intStr.length;
    const tuningDecimal = getTuningDecimalPosition(blk);
    digitsBefore = tuningDecimal !== null ? tuningDecimal : (isDelineation ? 0 : (hasPscale ? intStr.length : -1));
    if (tuningDecimal !== null) hasPscale = true;

    // Tuning fork compensation: if tuning's tree-side depth exceeds
    // spindle's, block has grown treeward. Prepend the difference in 0s.
    if (tuningDecimal !== null) {
      const needed = Math.max(0, tuningDecimal - spindleTreeDepth);
      if (needed > 0) {
        const maxComp = getCompressionDepth(blk.tree);
        const zeros = Math.min(needed, maxComp);
        if (zeros > 0) {
          walkDigits = Array(zeros).fill('0').concat(walkDigits);
        }
      }
    }
  }

  // Build spindle — root always included
  const nodes = [];
  let node = blk.tree;

  // Root: the block's identity (tree._)
  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
  }

  // Walk digits through the tree
  for (let i = 0; i < walkDigits.length; i++) {
    const d = walkDigits[i];
    if (!node || typeof node !== 'object' || node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string'
      ? node
      : (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
        ? node['_']
        : JSON.stringify(node);
    nodes.push({
      pscale: hasPscale ? (digitsBefore - 1) - i : null,
      digit: d,
      text
    });
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  // Point mode — return the semantic at the specified pscale level
  // String modes: '~' = spread (X~), '*' = tree (recursive subtree)
  if (point !== undefined && point !== null) {
    if (typeof point === 'string' && !isNaN(Number(point)) && point !== '~' && point !== '*') {
      point = Number(point);
    }
    if (typeof point === 'string') {
      const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
      if (point === '~') {
        const spread = xSpread(blk, endPath);
        if (!spread) return { mode: 'spread', path: endPath, text: null, children: [] };
        return { mode: 'spread', path: endPath, ...spread };
      }
      if (point === '*') {
        const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
        if (!endNode) return { mode: 'tree', path: endPath, text: null, children: [] };
        const subtree = resolveBlock({ tree: endNode }, 9);
        return { mode: 'tree', path: endPath, text: subtree.text, children: subtree.children };
      }
      return { mode: 'error', error: `Unknown point mode: ${point}` };
    }
    // Numeric: pscale extraction
    const target = nodes.find(n => n.pscale === point);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale };
  }

  // Spindle mode — return the full chain, high pscale to low
  return { mode: 'spindle', nodes };
}

// ============ BLOCK OPERATIONS ============

function blockReadNode(block, path) {
  const node = blockNavigate(block, path);
  if (node === null || node === undefined) return { error: `Path ${path} not found` };
  if (typeof node === 'string') return { content: node };
  const result = { content: node._ || null, children: {} };
  for (const [k, v] of Object.entries(node)) {
    if (k === '_') continue;
    if (typeof v === 'string') result.children[k] = v;
    else if (v && typeof v === 'object') result.children[k] = v._ || '(branch)';
  }
  return result;
}

function blockWriteNode(block, path, content) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = block.tree;
  for (const k of keys) {
    if (typeof node[k] === 'string') node[k] = { _: node[k] };
    if (!node[k]) node[k] = {};
    node = node[k];
  }
  if (node[last] && typeof node[last] === 'object') {
    node[last]._ = content;
  } else {
    node[last] = content;
  }
  return { success: true };
}

function findUnoccupiedDigit(block, path) {
  const node = path ? blockNavigate(block, path) : block.tree;
  if (!node || typeof node === 'string') return { digit: '1', note: 'Node is leaf — will become branch' };
  for (let d = 1; d <= 9; d++) {
    if (!node[String(d)]) return { digit: String(d) };
  }
  return { full: true, note: 'Digits 1-9 all occupied — compression needed' };
}

function checkCompression(block, path) {
  const node = path ? blockNavigate(block, path) : block.tree;
  if (!node || typeof node === 'string') return { needed: false };
  let occupied = 0;
  for (let d = 1; d <= 9; d++) {
    if (node[String(d)] !== undefined) occupied++;
  }
  return { needed: occupied >= 9, occupied };
}

// ============ EXPORTS ============

export {
  bsp,
  bspRegister,
  blockNavigate,
  blockReadNode,
  blockWriteNode,
  xSpread,
  resolveBlock,
  getTuningDecimalPosition,
  getCompressionDepth,
  findUnoccupiedDigit,
  checkCompression
};
