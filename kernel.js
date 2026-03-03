// HERMITCRAB MÖBIUS — Minimal Kernel
// The reflexive spine IS the program. BSP is the only navigation.
// Wake-driven: the kernel reads wake for ALL decisions.
// The twist: tool call → block mutation → recompile currents → new API call.

(async function boot() {
  const root = document.getElementById('root');
  const STORE = 'hc:';
  const CONV_KEY = 'hc_conversation';

  // ═══════ §1 BLOCK STORAGE ═══════

  function blockLoad(name) {
    if (typeof name === 'object' && name !== null) return name;
    const raw = localStorage.getItem(STORE + name);
    return raw ? JSON.parse(raw) : null;
  }

  function blockSave(name, block) {
    localStorage.setItem(STORE + name, JSON.stringify(block));
    if (_ctx) _ctx.changed.add(name);
  }

  function blockList() {
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STORE) && !key.startsWith(STORE + '_')) names.push(key.slice(STORE.length));
    }
    return names;
  }

  // ═══════ §2 BSP — Block · Spindle · Point ═══════

  function blockNavigate(block, path) {
    if (!path) return block.tree;
    const keys = path.split('.');
    let node = block.tree;
    for (const k of keys) {
      if (node === null || node === undefined || typeof node === 'string') return null;
      node = node[k];
    }
    return node;
  }

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

  function xSpread(block, path) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;
    if (!blk) return null;
    const node = path ? blockNavigate(blk, path) : blk.tree;
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

  function bsp(block, spindle, point) {
    const blk = typeof block === 'string' ? blockLoad(block) : block;
    if (!blk || !blk.tree) return { mode: 'block', tree: {} };

    // Block mode
    if ((spindle === undefined || spindle === null) && typeof point !== 'string') {
      return { mode: 'block', tree: blk.tree };
    }

    // Parse semantic number
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

    // Build spindle — root always included
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
      nodes.push({ pscale: hasPscale ? (digitsBefore - 1) - i : null, digit: d, text });
    }

    if (nodes.length === 0) return { mode: 'spindle', nodes: [] };

    // Point mode
    if (point !== undefined && point !== null) {
      if (typeof point === 'string' && !isNaN(Number(point)) && point !== '~' && point !== '*') {
        point = Number(point);
      }
      if (typeof point === 'string') {
        const endPath = walkDigits.length > 0 ? walkDigits.join('.') : null;
        if (point === '*') {
          // Ring: spindle context + one level of children at endpoint
          const spread = xSpread(blk, endPath);
          const children = spread ? spread.children : [];
          return { mode: 'ring', nodes, children };
        }
        if (point === '~') {
          // Spread: raw subtree extraction at endpoint (for merging, manipulation)
          const endNode = endPath ? blockNavigate(blk, endPath) : blk.tree;
          return { mode: 'spread', path: endPath, subtree: endNode || null };
        }
        return { mode: 'error', error: `Unknown point mode: ${point}` };
      }
      const target = nodes.find(n => n.pscale === point);
      if (target) return { mode: 'point', text: target.text, pscale: target.pscale };
      const last = nodes[nodes.length - 1];
      return { mode: 'point', text: last.text, pscale: last.pscale };
    }

    return { mode: 'spindle', nodes };
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
        const child = walk(v, depth + 1, path ? `${path}.${k}` : k);
        if (child) result.children.push(child);
      }
      return result;
    }
    return walk(block.tree, 0, '');
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

  // ═══════ §3 WAKE READER ═══════
  // The kernel reads wake for ALL decisions. These functions extract
  // concern mapping, packages, invocation params, and echo state.

  // Find concern: wake.2 maps stimulus type → { spindle, tier }
  function findConcern(stimulus) {
    const wake = blockLoad('wake');
    if (!wake) return { spindle: '0.1211111', tier: 2 };
    const map = wake.tree?.['2'];
    if (!map || typeof map !== 'object') return { spindle: '0.1211111', tier: 2 };
    for (let d = 1; d <= 9; d++) {
      const entry = map[String(d)];
      if (!entry || typeof entry !== 'object') continue;
      if ((entry._ || '').toLowerCase() === stimulus.toLowerCase()) {
        return {
          spindle: entry['1'] || '0.1211111',
          tier: parseInt(entry['2']) || 2,
          name: entry._ || stimulus
        };
      }
    }
    // Default: user engagement
    return { spindle: '0.1211111', tier: 2, name: 'user' };
  }

  // Read package entries: wake.9.{tier} → list of BSP instructions
  function readPackage(tier) {
    const wake = blockLoad('wake');
    if (!wake) return [];
    const spread = xSpread(wake, '9.' + tier);
    if (!spread) return [];
    return spread.children.filter(c => c.text).map(c => c.text);
  }

  // Read invocation params: wake.9.{tier+3} → { model, max_tokens, thinking? }
  function readInvocation(tier) {
    const wake = blockLoad('wake');
    if (!wake) return { model: 'claude-sonnet-4-6', max_tokens: 16384 };
    const spread = xSpread(wake, '9.' + (tier + 3));
    if (!spread) return { model: 'claude-sonnet-4-6', max_tokens: 16384 };
    const params = {};
    for (const child of spread.children) {
      if (child.text) {
        const idx = child.text.indexOf(' ');
        if (idx > 0) params[child.text.substring(0, idx)] = child.text.substring(idx + 1);
      }
    }
    const result = {
      model: params.model || 'claude-sonnet-4-6',
      max_tokens: parseInt(params.max_tokens) || 16384,
    };
    if (params.thinking) {
      const parts = params.thinking.split(' ');
      if (parts[0] === 'enabled' && parts[1]) {
        result.thinking = { type: 'enabled', budget_tokens: parseInt(parts[1]) };
      }
    }
    return result;
  }

  // Update echo state: write to the spine at depth 4 of the active spindle
  // The spindle address encodes the path — first 4 digits are the echo node
  function updateEchoState(spindle, echo, budget, changed) {
    const wake = blockLoad('wake');
    if (!wake) return;
    // Parse spindle to get path digits: 0.1211111 → [1,2,1,1,1,1,1] → first 4 = 1.2.1.1
    const str = typeof spindle === 'number' ? spindle.toFixed(10) : String(spindle);
    const parts = str.split('.');
    const fracStr = (parts[1] || '').replace(/0+$/, '');
    const digits = fracStr.split('');
    if (digits.length < 4) return;
    const echoPath = '1.' + digits.slice(0, 3).join('.');
    // Write echo state into the spine — this is the ONLY mutable node
    const changedStr = changed.size > 0 ? [...changed].join(', ') : 'none';
    const node = blockNavigate(wake, echoPath);
    if (node && typeof node === 'object') {
      node._ = `Echo ${echo}. Budget: ${budget - echo} remaining. Blocks changed: ${changedStr}.`;
      blockSave('wake', wake);
    }
  }

  // Read birth instructions: wake.3.1 → list of BSP instructions for first boot
  function readBirthInstructions() {
    const wake = blockLoad('wake');
    if (!wake) return null;
    const spread = xSpread(wake, '3.1');
    if (!spread) return null;
    const instructions = spread.children.filter(c => c.text).map(c => c.text);
    return instructions.length > 0 ? instructions : null;
  }

  // Read birth stimulus: wake.3.2
  function readBirthStimulus() {
    const wake = blockLoad('wake');
    if (!wake) return 'You exist. Your blocks are your shell. Read, then build.';
    const node = wake.tree?.['3']?.['2'];
    return typeof node === 'string' ? node : 'You exist. Your blocks are your shell. Read, then build.';
  }

  // ═══════ §4 CURRENTS COMPILER ═══════
  // BSP each package entry → system prompt sections.
  // The spine spindle is the primary orienting current.

  function parseInstruction(instr) {
    const parts = instr.trim().split(/\s+/);
    const point = parts.length > 2 ? parts[2] : undefined;
    return {
      blockName: parts[0],
      spindle: parts.length > 1 ? parseFloat(parts[1]) : undefined,
      point: (point === '~' || point === '*') ? point : (point !== undefined ? parseFloat(point) : undefined)
    };
  }

  function formatBlockContent(block) {
    const lines = [];
    function render(node, depth) {
      if (typeof node === 'string') { lines.push('  '.repeat(depth) + node); return; }
      if (!node || typeof node !== 'object') return;
      if (node._) lines.push('  '.repeat(depth) + node._);
      for (const [k, v] of Object.entries(node)) {
        if (k === '_') continue;
        if (typeof v === 'string') lines.push('  '.repeat(depth) + `${k}: ${v}`);
        else { lines.push('  '.repeat(depth) + `${k}:`); render(v, depth + 1); }
      }
    }
    render(block.tree, 0);
    return lines.join('\n');
  }

  function executeInstruction(instr) {
    const { blockName, spindle, point } = parseInstruction(instr);
    const block = blockLoad(blockName);
    if (!block) return '';
    const result = bsp(block, spindle, point);
    if (result.mode === 'block') return `[${blockName}]\n${formatBlockContent(block)}`;
    if (result.mode === 'spindle') {
      if (result.nodes.length === 0) return '';
      return `[${blockName} ${spindle}]\n${result.nodes.map(n => `  [${n.pscale}] ${n.text}`).join('\n')}`;
    }
    if (result.mode === 'point') return `[${blockName} ${spindle} ${point}] ${result.text}`;
    if (result.mode === 'ring') {
      // Spindle context + one level of children
      const spine = result.nodes.map(n => `  [${n.pscale}] ${n.text}`);
      const kids = (result.children || []).map(c => `    ${c.digit}: ${c.text || '(branch)'}${c.branch ? ' +' : ''}`);
      return `[${blockName} ${spindle} *]\n${spine.join('\n')}\n${kids.join('\n')}`;
    }
    if (result.mode === 'spread') {
      // Raw subtree — format as JSON for extraction
      return `[${blockName} ${spindle} ~]\n${JSON.stringify(result.subtree, null, 2)}`;
    }
    return '';
  }

  // Compile the full currents window for an activation
  function compileCurrents(concern, echo, budget) {
    const sections = [];

    // §A — The spine: full reflexive spindle from wake
    const spineResult = bsp('wake', parseFloat(concern.spindle));
    if (spineResult.mode === 'spindle' && spineResult.nodes.length > 0) {
      sections.push(`[spine ${concern.spindle}]\n${spineResult.nodes.map(n => `  [${n.pscale}] ${n.text}`).join('\n')}`);
    }

    // §B — Package currents: BSP each entry from wake.9.{tier}
    const instructions = readPackage(concern.tier);
    for (const instr of instructions) {
      const result = executeInstruction(instr);
      if (result) sections.push(result);
    }

    return sections.join('\n\n');
  }

  // First boot: compile from birth instructions instead of tier package
  function compileBirthCurrents() {
    const sections = [];
    const birthInstructions = readBirthInstructions();
    if (!birthInstructions) {
      // Fallback: pscale 0 of all blocks
      return blockList().map(name => {
        const b = blockLoad(name);
        return b ? `[${name}] ${b.tree?._ || ''}` : '';
      }).filter(l => l).join('\n\n');
    }

    // Birth spine: wake spindle from birth instructions line 1 ("wake 0.1311111")
    const firstInstr = birthInstructions[0];
    if (firstInstr && firstInstr.startsWith('wake ')) {
      const result = executeInstruction(firstInstr);
      if (result) sections.push(result);
    }

    // Remaining birth instructions
    for (let i = 1; i < birthInstructions.length; i++) {
      const result = executeInstruction(birthInstructions[i]);
      if (result) sections.push(result);
    }

    return sections.join('\n\n');
  }

  // ═══════ §5 API LAYER ═══════

  async function callAPI(params) {
    const apiKey = localStorage.getItem('hermitcrab_api_key');
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith('_') || v === undefined || v === null) continue;
      clean[k] = v;
    }
    if (clean.thinking && clean.temperature !== undefined && clean.temperature !== 1) delete clean.temperature;
    console.log('[möbius] callAPI →', clean.model, 'messages:', clean.messages?.length);

    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(clean)
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`API ${res.status}: ${err}`); }
    const data = await res.json();
    if (data.type === 'error') throw new Error(`Claude: ${data.error?.message || JSON.stringify(data.error)}`);
    return data;
  }

  // ═══════ §6 TOOLS ═══════

  const TOOLS = [
    {
      name: 'block_read',
      description: 'Read a pscale block by name, optionally at a path. Returns content + immediate children.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' } }, required: ['name'] }
    },
    {
      name: 'block_write',
      description: 'Write content to a path in a block. Creates intermediate nodes as needed.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'block_list',
      description: 'List all blocks with pscale-0 summaries.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'block_create',
      description: 'Create a new block with a root summary.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, pscale0: { type: 'string' } }, required: ['name', 'pscale0'] }
    },
    {
      name: 'bsp',
      description: 'Block·Spindle·Point — semantic address resolution.\nbsp(name) → full block\nbsp(name, 0.21) → spindle (depth walk)\nbsp(name, 0.21, -1) → point at pscale\nbsp(name, 0.21, "*") → ring (spindle context + one level of children)\nbsp(name, 0.21, "~") → spread (raw subtree extraction)',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          spindle: { type: 'number' },
          point: { description: "Number: pscale level. '*': ring (spindle + one-level children). '~': spread (raw subtree extraction).", oneOf: [{ type: 'number' }, { type: 'string', enum: ['*', '~'] }] }
        },
        required: ['name']
      }
    },
    {
      name: 'write_entry',
      description: 'Add entry at next free digit (1-9) under a path. Reports if compression needed.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'path', 'content'] }
    },
    {
      name: 'compress',
      description: 'Compress a full node (all 9 digits occupied). Delegates to LLM for summary vs emergence.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, path: { type: 'string' } }, required: ['name', 'path'] }
    },
    {
      name: 'resolve',
      description: 'Phrase-level view of a block — text at each node, up to depth.',
      input_schema: { type: 'object', properties: { name: { type: 'string' }, depth: { type: 'integer' } }, required: ['name'] }
    },
    {
      name: 'get_source',
      description: 'Get current JSX shell source.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'recompile',
      description: 'Hot-swap React shell with new JSX. Props: { callLLM, blockRead, blockWrite, blockList, blockCreate, bsp, resolve, browser, conversation, React, ReactDOM, getSource, recompile, setTools, version, localStorage }. Use props.callLLM([{role:"user",content:text}]) to message the LLM.',
      input_schema: { type: 'object', properties: { jsx: { type: 'string' } }, required: ['jsx'] }
    },
    {
      name: 'call_llm',
      description: 'Delegate to another LLM instance. "fast" = Haiku, "default" = Opus.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string' }, model: { type: 'string', enum: ['default', 'fast'] }, system: { type: 'string' } }, required: ['prompt'] }
    },
    {
      name: 'get_datetime',
      description: 'Current date, time, timezone.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'github_save',
      description: 'Save all blocks to a GitHub repo. Requires a GitHub PAT stored in localStorage (hermitcrab_github_pat). Pushes each block as blocks/{name}.json in a single commit.',
      input_schema: { type: 'object', properties: { owner: { type: 'string', description: 'GitHub username or org' }, repo: { type: 'string', description: 'Repository name' } }, required: ['owner', 'repo'] }
    },
    {
      name: 'github_restore',
      description: 'Restore all blocks from a GitHub repo. Pulls blocks/{name}.json files and loads them into localStorage. Requires a GitHub PAT.',
      input_schema: { type: 'object', properties: { owner: { type: 'string', description: 'GitHub username or org' }, repo: { type: 'string', description: 'Repository name' } }, required: ['owner', 'repo'] }
    }
  ];

  // Server-side tools
  const SERVER_TOOLS = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 }
  ];

  let currentTools = [...TOOLS, ...SERVER_TOOLS];
  let currentJSX = null;
  let reactRoot = null;

  async function executeTool(name, input) {
    switch (name) {
      case 'block_read': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        return input.path ? JSON.stringify(blockReadNode(block, input.path)) : JSON.stringify(block);
      }
      case 'block_write': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        blockWriteNode(block, input.path, input.content);
        blockSave(input.name, block);
        return JSON.stringify({ success: true });
      }
      case 'block_list': {
        return JSON.stringify(blockList().map(name => {
          const b = blockLoad(name);
          return { name, pscale0: b?.tree?._ || '' };
        }));
      }
      case 'block_create': {
        if (blockLoad(input.name)) return JSON.stringify({ error: `"${input.name}" exists` });
        blockSave(input.name, { tree: { _: input.pscale0 } });
        return JSON.stringify({ success: true, name: input.name });
      }
      case 'bsp': {
        const result = bsp(input.name, input.spindle, input.point);
        if (result.mode === 'block' && Object.keys(result.tree).length === 0) {
          return JSON.stringify({ error: `Block "${input.name}" not found` });
        }
        return JSON.stringify(result);
      }
      case 'write_entry': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        const slot = findUnoccupiedDigit(block, input.path);
        if (slot.full) return JSON.stringify({ error: 'All digits 1-9 occupied — compress first', path: input.path });
        const writePath = input.path ? `${input.path}.${slot.digit}` : slot.digit;
        blockWriteNode(block, writePath, input.content);
        blockSave(input.name, block);
        return JSON.stringify({ success: true, path: writePath, digit: slot.digit });
      }
      case 'compress': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        const check = checkCompression(block, input.path);
        if (!check.needed) return JSON.stringify({ error: `Only ${check.occupied}/9 occupied` });
        const spread = xSpread(block, input.path || null);
        const entries = spread ? spread.children.map(c => `${c.digit}: ${c.text || '(branch)'}`) : [];
        const inv = readInvocation(1);
        const res = await callAPI({
          model: inv.model,
          max_tokens: 2048,
          system: 'You are a compression engine. Determine: SUMMARY (parts add up) or EMERGENCE (whole > parts). Return only the compressed text.',
          messages: [{ role: 'user', content: entries.join('\n') }],
        });
        const resultText = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        if (input.path) {
          const parentKeys = input.path.split('.');
          const parentPath = parentKeys.slice(0, -1).join('.') || null;
          if (parentPath) blockWriteNode(block, parentPath, resultText);
          else { if (typeof block.tree === 'string') block.tree = { _: resultText }; else block.tree._ = resultText; }
        }
        blockSave(input.name, block);
        return JSON.stringify({ success: true, compressed: resultText });
      }
      case 'resolve': {
        const block = blockLoad(input.name);
        if (!block) return JSON.stringify({ error: `Block "${input.name}" not found` });
        return JSON.stringify(resolveBlock(block, input.depth || 3));
      }
      case 'get_source':
        return currentJSX || '(no source available)';
      case 'recompile':
        return JSON.stringify(recompile(input.jsx));
      case 'call_llm': {
        const tier = input.model === 'fast' ? 1 : 3;
        const inv = readInvocation(tier);
        const res = await callAPI({
          model: inv.model,
          max_tokens: inv.max_tokens,
          system: input.system || 'You are a delegate. Complete the task. Return only the result.',
          messages: [{ role: 'user', content: input.prompt }],
          thinking: inv.thinking,
        });
        return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '(no response)';
      }
      case 'get_datetime':
        return JSON.stringify({ iso: new Date().toISOString(), unix: Date.now(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      case 'github_save': {
        const pat = localStorage.getItem('hermitcrab_github_pat');
        if (!pat) return JSON.stringify({ error: 'No GitHub PAT. Ask user to provide one, then store with: localStorage.setItem("hermitcrab_github_pat", token)' });
        const blocks = {};
        for (const name of blockList()) { blocks[name] = blockLoad(name); }
        const r = await fetch('/api/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-GitHub-Token': pat },
          body: JSON.stringify({ action: 'save', owner: input.owner, repo: input.repo, blocks })
        });
        const data = await r.json();
        if (!r.ok) return JSON.stringify({ error: data.error || `GitHub save failed: ${r.status}` });
        return JSON.stringify(data);
      }
      case 'github_restore': {
        const pat = localStorage.getItem('hermitcrab_github_pat');
        if (!pat) return JSON.stringify({ error: 'No GitHub PAT. Ask user to provide one, then store with: localStorage.setItem("hermitcrab_github_pat", token)' });
        const r = await fetch('/api/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-GitHub-Token': pat },
          body: JSON.stringify({ action: 'restore', owner: input.owner, repo: input.repo })
        });
        const data = await r.json();
        if (!r.ok) return JSON.stringify({ error: data.error || `GitHub restore failed: ${r.status}` });
        if (data.blocks) {
          for (const [name, block] of Object.entries(data.blocks)) { blockSave(name, block); }
        }
        return JSON.stringify({ success: true, restored: data.count, blocks: Object.keys(data.blocks || {}) });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  // ═══════ §7 THE TWIST ═══════
  // call API → if tool_use → execute tools → increment echo →
  // update echo state in spine depth 4 → recompile currents → re-call
  // This IS the Möbius B-loop.

  let _ctx = null; // { echo, budget, changed, concern }

  async function twist(params, concern) {
    const budget = parseInt(
      bsp('wake', parseFloat(concern.spindle), -3)?.text?.match(/Budget:\s*(\d+)/)?.[1]
    ) || 10;

    _ctx = { echo: 0, budget, changed: new Set(), concern };

    try {
      let response = await callAPI(params);
      let allMessages = [...params.messages];

      while (response.stop_reason === 'tool_use' && _ctx.echo < budget) {
        const toolBlocks = (response.content || []).filter(b => b.type === 'tool_use');
        const serverBlocks = (response.content || []).filter(b => b.type === 'server_tool_use');

        // Log server tools
        for (const b of serverBlocks) console.log(`[möbius] server: ${b.name}`);

        // pause_turn with no client tools
        if (response.stop_reason === 'pause_turn' && toolBlocks.length === 0) {
          allMessages = [...allMessages, { role: 'assistant', content: response.content }];
          response = await callAPI({ ...params, messages: allMessages });
          continue;
        }

        if (toolBlocks.length === 0) break;

        // Execute all tools
        const results = [];
        let recompiledThisEcho = false;
        for (const tb of toolBlocks) {
          console.log(`[möbius] tool: ${tb.name}`, tb.input);
          const result = await executeTool(tb.name, tb.input);
          results.push({ type: 'tool_result', tool_use_id: tb.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
          if (tb.name === 'recompile') recompiledThisEcho = true;
        }

        if (recompiledThisEcho) {
          console.log('[möbius] shell recompiled — exiting twist');
          break;
        }

        allMessages = [...allMessages, { role: 'assistant', content: response.content }, { role: 'user', content: results }];

        // THE TWIST: increment echo, update spine, recompile currents
        _ctx.echo++;
        updateEchoState(concern.spindle, _ctx.echo, budget, _ctx.changed);
        const freshSystem = compileCurrents(concern, _ctx.echo, budget);
        params = { ...params, system: freshSystem };
        _ctx.changed.clear();

        console.log(`[möbius] twist: echo ${_ctx.echo}/${budget}`);
        response = await callAPI({ ...params, messages: allMessages });
      }

      // Auto-save to history
      autoSaveHistory(response, _ctx.echo);
      response._messages = allMessages;
      response._echo = _ctx.echo;
      return response;

    } finally {
      _ctx = null;
    }
  }

  function autoSaveHistory(response, echo) {
    try {
      const texts = (response.content || []).filter(b => b.type === 'text');
      if (texts.length === 0) return;
      const block = blockLoad('history');
      if (!block) return;
      const slot = findUnoccupiedDigit(block, '');
      if (slot.full) return;
      const text = texts.map(b => b.text).join('\n');
      blockWriteNode(block, slot.digit, `[${new Date().toISOString()} echo:${echo}] ${text}`);
      blockSave('history', block);
    } catch (e) { console.error('[möbius] history save failed:', e); }
  }

  // ═══════ §8 SHELL ═══════

  function extractJSX(text) {
    const match = text.match(/```(?:jsx|react|javascript|js)?\s*\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  function prepareJSX(jsx) {
    let code = jsx;
    code = code.replace(/^import\s+.*?;?\s*$/gm, '');
    code = code.replace(/export\s+default\s+function\s+(\w+)/g, 'function $1');
    code = code.replace(/export\s+default\s+/g, 'module.exports.default = ');
    code = code.replace(/^return\s+(function|class)\s/m, '$1 ');
    code = code.replace(/^return\s+([A-Z]\w+)\s*;?\s*$/m, 'module.exports.default = $1;');
    const funcMatch = code.match(/(?:^|\n)\s*function\s+(\w+)/);
    const constMatch = code.match(/(?:^|\n)\s*const\s+(\w+)\s*=\s*(?:\(|function|\(\s*\{|\(\s*props)/);
    const name = funcMatch?.[1] || constMatch?.[1];
    if (name && funcMatch) code = code.replace(new RegExp('function\\s+' + name + '\\s*\\(\\s*\\)'), 'function ' + name + '(props)');
    if (name && constMatch && !funcMatch) code = code.replace(new RegExp('const\\s+' + name + '\\s*=\\s*\\(\\s*\\)\\s*=>'), 'const ' + name + ' = (props) =>');
    if (name && !code.includes('module.exports')) code += `\nmodule.exports.default = ${name};`;
    return code;
  }

  let props = null;

  function recompile(newJSX) {
    if (!newJSX || typeof newJSX !== 'string') return { success: false, error: 'JSX string required' };
    try {
      const prepared = prepareJSX(newJSX);
      const compiled = Babel.transform(prepared, { presets: ['react'] }).code;
      const module = { exports: {} };
      new Function('React', 'ReactDOM', 'capabilities', 'module', 'exports', compiled)(React, ReactDOM, props, module, module.exports);
      const Component = module.exports.default || module.exports;
      if (typeof Component !== 'function') return { success: false, error: 'No React component exported' };
      currentJSX = newJSX;
      try { localStorage.setItem('hc:_jsx', newJSX); } catch (e) {}
      if (!reactRoot) reactRoot = ReactDOM.createRoot(root);
      reactRoot.render(React.createElement(Component, props));
      console.log('[möbius] recompile succeeded');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Public callLLM for shell props
  let _activationLock = false;
  async function callLLM(messages, opts = {}) {
    if (_activationLock) return '[activation in progress]';
    _activationLock = true;
    try {
      const stimulus = opts.stimulus || 'user';
      const concern = findConcern(stimulus);
      const inv = readInvocation(opts.tier || concern.tier);
      const system = opts.system || compileCurrents(concern, 0, 10);
      const params = {
        model: opts.model || inv.model,
        max_tokens: opts.max_tokens || inv.max_tokens,
        system,
        messages: messages || [],
        tools: currentTools,
        thinking: inv.thinking,
      };
      if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
        params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
      }
      const response = await twist(params, concern);
      if (opts.raw) return response;
      return (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
    } finally {
      _activationLock = false;
    }
  }

  function saveConversation(messages) {
    try { localStorage.setItem(CONV_KEY, JSON.stringify(messages)); } catch (e) {}
  }
  function loadConversation() {
    try { const raw = localStorage.getItem(CONV_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  }
  function getSource() { return currentJSX || '(no source available)'; }
  function setTools(arr) { currentTools = arr; return 'Tools updated'; }

  const browser = {
    clipboard: { write: (t) => navigator.clipboard.writeText(t), read: () => navigator.clipboard.readText() },
    speak: (text) => { const u = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(u); },
    notify: (title, body) => { if (Notification.permission === 'granted') new Notification(title, { body }); },
    download: (fn, content, mime) => {
      const b = new Blob([content], { type: mime || 'text/plain' });
      const u = URL.createObjectURL(b); const a = document.createElement('a');
      a.href = u; a.download = fn; document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(u);
    }
  };

  props = {
    callLLM, callAPI,
    React, ReactDOM, getSource, recompile, setTools, browser,
    conversation: { save: saveConversation, load: loadConversation },
    blockRead: (name, path) => { const b = blockLoad(name); if (!b) return null; return path ? blockReadNode(b, path) : b; },
    blockWrite: (name, path, content) => { const b = blockLoad(name); if (!b) return { error: 'not found' }; blockWriteNode(b, path, content); blockSave(name, b); return { success: true }; },
    blockList, blockCreate: (name, p0) => { if (blockLoad(name)) return { error: 'exists' }; blockSave(name, { tree: { _: p0 } }); return { success: true }; },
    bsp: (name, spindle, point) => bsp(name, spindle, point),
    resolve: (name, depth) => { const b = blockLoad(name); if (!b) return null; return resolveBlock(b, depth || 3); },
    version: 'hermitcrab-möbius-v1',
    localStorage
  };

  // ═══════ §9 BOOT ═══════

  // Status display
  let statusLines = [];
  function status(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    statusLines.push({ msg, type, time });
    root.innerHTML = `
      <div style="max-width:600px;margin:40px auto;font-family:monospace;padding:20px">
        <h2 style="color:#67e8f9;margin-bottom:16px">◇ HERMITCRAB MÖBIUS</h2>
        ${statusLines.map(s => {
          const color = s.type === 'error' ? '#f87171' : s.type === 'success' ? '#4ade80' : '#67e8f9';
          return `<div style="color:${color};margin:4px 0;font-size:13px"><span style="color:#555">${s.time}</span> ${s.msg}</div>`;
        }).join('')}
        <div style="color:#555;margin-top:12px;font-size:11px">${
          statusLines[statusLines.length - 1]?.type === 'error' ? '' : '▪ working...'
        }</div>
      </div>`;
  }

  // API key gate
  const saved = localStorage.getItem('hermitcrab_api_key');
  if (!saved) {
    root.innerHTML = `
      <div style="max-width:500px;margin:80px auto;font-family:monospace;color:#ccc">
        <h2 style="color:#67e8f9">◇ HERMITCRAB MÖBIUS</h2>
        <p style="color:#666;font-size:13px">Reflexive spine kernel — pscale native</p>
        <p style="margin:20px 0;font-size:14px">
          Provide your Claude API key. It stays in your browser, proxied only to Anthropic.
        </p>
        <input id="key" type="password" placeholder="sk-ant-api03-..."
          style="width:100%;padding:8px;background:#1a1a2e;border:1px solid #333;color:#ccc;font-family:monospace;border-radius:4px" />
        <button id="go" style="margin-top:12px;padding:8px 20px;background:#164e63;color:#ccc;border:none;border-radius:4px;cursor:pointer;font-family:monospace">
          Wake kernel
        </button>
      </div>`;
    document.getElementById('go').onclick = () => {
      const k = document.getElementById('key').value.trim();
      if (!k.startsWith('sk-ant-')) return alert('Key must start with sk-ant-');
      localStorage.setItem('hermitcrab_api_key', k);
      boot();
    };
    return;
  }

  // Seed loading
  async function loadSeed() {
    try {
      const scriptSrc = document.querySelector('script[src*="kernel.js"]')?.src || '';
      const base = scriptSrc ? scriptSrc.replace(/kernel\.js.*$/, '') : './';
      const res = await fetch(base + 'shell.json');
      if (!res.ok) throw new Error(`shell.json: ${res.status}`);
      const seed = await res.json();
      return seed.blocks || seed;
    } catch (e) {
      console.error('[möbius] Failed to load shell.json:', e.message);
      return null;
    }
  }

  // Seed blocks if empty
  const existing = blockList();
  if (existing.length === 0) {
    status('no blocks found — loading seed...');
    const seed = await loadSeed();
    if (!seed) { status('no shell.json — cannot boot', 'error'); return; }
    let seeded = 0;
    for (const [name, block] of Object.entries(seed)) {
      if (!blockLoad(name)) { blockSave(name, block); seeded++; }
    }
    status(`seeded ${seeded} blocks`, 'success');
  } else {
    status(`${existing.length} blocks loaded`, 'success');
  }

  // Detect first boot: history has no entries
  function isFirstBoot() {
    const h = blockLoad('history');
    if (!h || !h.tree) return true;
    for (let d = 1; d <= 9; d++) { if (h.tree[String(d)] !== undefined) return false; }
    return true;
  }

  const firstBoot = isFirstBoot();

  // Warm boot: restore persisted shell
  if (!firstBoot) {
    const savedJSX = localStorage.getItem('hc:_jsx');
    if (savedJSX) {
      const restored = recompile(savedJSX);
      if (restored.success) status('shell restored', 'success');
    }
  }

  // Determine concern and invoke
  const concern = firstBoot
    ? { spindle: '0.1311111', tier: 3, name: 'self-maintenance' }  // Birth: deep tier
    : findConcern('user');                                            // Return: user engagement

  const inv = readInvocation(concern.tier);
  status(`calling ${inv.model} — ${firstBoot ? 'BIRTH' : 'ACTIVATION'}...`);

  try {
    const system = firstBoot ? compileBirthCurrents() : compileCurrents(concern, 0, 10);
    const stimulus = firstBoot
      ? readBirthStimulus()
      : 'ACTIVATION — Returning instance. Context compiled from current blocks by BSP. Living currents active: the kernel recompiles your context after each tool round from mutated block state.';

    // Persist context window for debugging
    try { localStorage.setItem(STORE + '_context_window', JSON.stringify({ text: system, ts: Date.now() })); } catch (e) {}

    _activationLock = true;
    const params = {
      model: inv.model,
      max_tokens: inv.max_tokens,
      system,
      messages: [{ role: 'user', content: stimulus }],
      tools: currentTools,
      thinking: inv.thinking,
    };
    if (inv.thinking && params.max_tokens <= (inv.thinking.budget_tokens || 0)) {
      params.max_tokens = (inv.thinking.budget_tokens || 0) + 1024;
    }

    await twist(params, concern);
    _activationLock = false;

    if (currentJSX && reactRoot) {
      console.log('[möbius] Boot complete — shell live');
      return;
    }
    status('boot finished but no shell built — LLM did not call recompile()', 'error');

  } catch (e) {
    _activationLock = false;
    status(`boot failed: ${e.message}`, 'error');
    console.error('[möbius]', e);
  }
})();
