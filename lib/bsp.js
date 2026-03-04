// bsp.js — Block · Spindle · Point
// Semantic address resolver for pscale JSON blocks.
// Canonical JS implementation — kept in sync with kernel.js §2.
// Includes tuning fork compensation, ring/disc/dir modes, delineation handling.
//
// Seven modes:
//   bsp(block)                    → dir: full block tree
//   bsp(block, 'ref')             → ref: block named, zero tokens
//   bsp(block, spindle)           → spindle: path chain wide→specific
//   bsp(block, spindle, point)    → point: single node at pscale level
//   bsp(block, spindle, 'ring')   → ring: siblings at terminal point (no spindle)
//   bsp(block, spindle, 'dir')    → dir: subtree from endpoint down (no spindle)
//   bsp(block, spindle, pt, 'disc') → disc: all nodes at pscale pt, block-wide

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

let __blockLoader = null;

function bspRegister(loader) {
  __blockLoader = loader;
}

function bsp(block, spindle, point, fn) {
  // Resolve block
  const blockName = typeof block === 'string' ? block : null;
  const blk = typeof block === 'string'
    ? (__blockLoader ? __blockLoader(block) : null)
    : block;

  // Mode: reference — bsp(block, 'ref')
  if (spindle === 'ref') {
    return { mode: 'ref', block: blockName };
  }

  if (!blk || !blk.tree) return { mode: 'dir', tree: {} };

  // Mode: dir (full) — bsp(block) with no other args
  if (spindle == null && point == null && fn == null) {
    return { mode: 'dir', tree: blk.tree };
  }

  // ---- Parse the semantic number ----
  let walkDigits, hasPscale, digitsBefore;
  if (spindle == null) {
    // No spindle but other args present (e.g. disc with null spindle)
    walkDigits = [];
    hasPscale = true;
    const tuningDecimal = getTuningDecimalPosition(blk);
    digitsBefore = tuningDecimal !== null ? tuningDecimal : 0;
  } else {
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const intStr = parts[0] || '0';
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const isDelineation = intStr === '0';
    walkDigits = isDelineation
      ? fracStr.split('').filter(c => c.length > 0)
      : (intStr + fracStr).split('');
    hasPscale = isDelineation || fracStr.length > 0;
    const spindleTreeDepth = isDelineation ? 0 : intStr.length;
    const tuningDecimal = getTuningDecimalPosition(blk);
    digitsBefore = tuningDecimal !== null ? tuningDecimal : (isDelineation ? 0 : (hasPscale ? intStr.length : -1));
    if (tuningDecimal !== null) hasPscale = true;

    // Tuning fork compensation
    if (tuningDecimal !== null) {
      const needed = Math.max(0, tuningDecimal - spindleTreeDepth);
      if (needed > 0) {
        const maxComp = getCompressionDepth(blk.tree);
        const zeros = Math.min(needed, maxComp);
        if (zeros > 0) walkDigits = Array(zeros).fill('0').concat(walkDigits);
      }
    }
  }

  // ---- Build spindle nodes ----
  const nodes = [];
  let node = blk.tree;

  const rootText = (typeof node === 'object' && node !== null && typeof node['_'] === 'string')
    ? node['_'] : null;
  if (rootText !== null) {
    nodes.push({ pscale: hasPscale ? digitsBefore : null, text: rootText });
  }

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

  // ---- Mode: ring — siblings at terminal point ----
  if (point === 'ring') {
    if (walkDigits.length === 0) {
      return { mode: 'ring', siblings: [] };
    }
    const parentPath = walkDigits.length > 1 ? walkDigits.slice(0, -1).join('.') : null;
    const terminalDigit = walkDigits[walkDigits.length - 1];
    const parentNode = parentPath ? blockNavigate(blk, parentPath) : blk.tree;
    if (!parentNode || typeof parentNode !== 'object') return { mode: 'ring', siblings: [] };
    const siblings = [];
    for (let d = 0; d <= 9; d++) {
      const k = String(d);
      if (k === terminalDigit || parentNode[k] === undefined) continue;
      const v = parentNode[k];
      const childText = typeof v === 'string' ? v : (v && typeof v === 'object' && v._) ? v._ : null;
      siblings.push({ digit: k, text: childText, branch: typeof v === 'object' && v !== null });
    }
    return { mode: 'ring', siblings };
  }

  // ---- Mode: dir (subtree) — bsp(block, spindle, 'dir') ----
  if (point === 'dir') {
    const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
    const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
    return { mode: 'dir', path: endPath, subtree: endNode || null };
  }

  // ---- Mode: disc — transversal at pscale ----
  if (fn === 'disc' && point != null) {
    const pscale = typeof point === 'string' ? Number(point) : point;
    const tuningDecimal = getTuningDecimalPosition(blk);
    if (tuningDecimal === null) {
      // Without tuning, use digitsBefore as reference
      // (pscale is relative to the spindle's decimal position)
    }
    const refDecimal = tuningDecimal !== null ? tuningDecimal : digitsBefore;
    const targetDepth = refDecimal - pscale;
    if (targetDepth < 0) return { mode: 'disc', pscale, nodes: [] };

    const discNodes = [];
    function walkDisc(n, depth, path) {
      if (depth === targetDepth) {
        const text = typeof n === 'string' ? n
          : (n && typeof n === 'object' && typeof n._ === 'string') ? n._
          : null;
        discNodes.push({ path, text });
        return;
      }
      if (!n || typeof n !== 'object') return;
      for (let d = 0; d <= 9; d++) {
        const k = String(d);
        if (n[k] !== undefined) {
          walkDisc(n[k], depth + 1, path ? `${path}.${k}` : k);
        }
      }
    }
    walkDisc(blk.tree, 0, '');
    return { mode: 'disc', pscale, nodes: discNodes };
  }

  if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

  // ---- Mode: point — single node at pscale level ----
  if (point != null && fn == null) {
    const p = typeof point === 'string' ? Number(point) : point;
    if (isNaN(p)) return { mode: 'error', error: `Unknown mode: ${point}` };
    const target = nodes.find(n => n.pscale === p);
    if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
    const last = nodes[nodes.length - 1];
    return { mode: 'point', text: last.text, pscale: last.pscale };
  }

  // ---- Mode: spindle — full chain ----
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
  if (content === null || content === undefined) {
    delete node[last];
  } else if (node[last] && typeof node[last] === 'object') {
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
  getTuningDecimalPosition,
  getCompressionDepth,
  findUnoccupiedDigit,
  checkCompression
};
