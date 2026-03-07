import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GitHub API Proxy
 *
 * Routes block save/restore operations through Vercel to avoid browser CORS.
 * User provides their own GitHub PAT. This proxy passes it through to GitHub.
 *
 * Endpoints (via ?action= query param):
 *   save   — Push all blocks to a repo as individual JSON files
 *   restore — Pull all block JSON files from a repo
 *   list   — List files in the blocks/ directory of a repo
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://idiothuman.com',
    'https://www.idiothuman.com',
    'https://hermitcrab.me',
    'https://www.hermitcrab.me',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-github-token'] as string;
  if (!token) return res.status(400).json({ error: 'GitHub token required via X-GitHub-Token header' });

  const { action, owner, repo, blocks, state } = req.body;

  const gh = async (path: string, method = 'GET', body?: unknown) => {
    const opts: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`https://api.github.com${path}`, opts);
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`GitHub ${r.status}: ${err}`);
    }
    return r.json();
  };

  try {
    if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' });

    // ── LIST: get block files in repo ──
    if (action === 'list') {
      try {
        const contents = await gh(`/repos/${owner}/${repo}/contents/blocks`);
        const files = (contents as any[])
          .filter((f: any) => f.name.endsWith('.json'))
          .map((f: any) => ({ name: f.name.replace('.json', ''), sha: f.sha, size: f.size }));
        return res.status(200).json({ files });
      } catch (e: any) {
        if (e.message.includes('404')) return res.status(200).json({ files: [] });
        throw e;
      }
    }

    // ── RESTORE: pull all blocks and state from repo ──
    if (action === 'restore') {
      const contents = await gh(`/repos/${owner}/${repo}/contents/blocks`);
      const result: Record<string, unknown> = {};
      for (const file of (contents as any[])) {
        if (!file.name.endsWith('.json')) continue;
        const name = file.name.replace('.json', '');
        const fileData = await gh(`/repos/${owner}/${repo}/contents/blocks/${file.name}`);
        const content = Buffer.from((fileData as any).content, 'base64').toString('utf-8');
        try {
          result[name] = JSON.parse(content);
        } catch {
          result[name] = content;
        }
      }

      // Also restore state/ directory if it exists
      const stateResult: Record<string, unknown> = {};
      try {
        const stateContents = await gh(`/repos/${owner}/${repo}/contents/state`);
        for (const file of (stateContents as any[])) {
          const fileData = await gh(`/repos/${owner}/${repo}/contents/state/${file.name}`);
          const content = Buffer.from((fileData as any).content, 'base64').toString('utf-8');
          const key = file.name.replace(/\.(json|txt|js)$/, '');
          if (file.name.endsWith('.json')) {
            try { stateResult[key] = JSON.parse(content); } catch { stateResult[key] = content; }
          } else {
            stateResult[key] = content;
          }
        }
      } catch (e: any) {
        // state/ directory may not exist yet — that's fine
        if (!e.message.includes('404')) throw e;
      }

      return res.status(200).json({
        blocks: result,
        state: Object.keys(stateResult).length > 0 ? stateResult : undefined,
        count: Object.keys(result).length,
      });
    }

    // ── SAVE: push all blocks to repo ──
    if (action === 'save') {
      if (!blocks || typeof blocks !== 'object') {
        return res.status(400).json({ error: 'blocks object required for save' });
      }

      // Get current main branch SHA
      const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/main`);
      const mainSha = (ref as any).object.sha;
      const commit = await gh(`/repos/${owner}/${repo}/git/commits/${mainSha}`);
      const treeSha = (commit as any).tree.sha;

      // Create blobs for each block
      const treeItems: any[] = [];
      for (const [name, block] of Object.entries(blocks)) {
        const content = JSON.stringify(block, null, 2);
        const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, 'POST', {
          content: Buffer.from(content).toString('base64'),
          encoding: 'base64',
        });
        treeItems.push({
          path: `blocks/${name}.json`,
          mode: '100644',
          type: 'blob',
          sha: (blob as any).sha,
        });
      }

      // Add state files to the same commit if provided
      if (state && typeof state === 'object') {
        const stateFiles: Record<string, string> = {};
        if (state.jsx) stateFiles['state/jsx.txt'] = state.jsx;
        if (state.conversations) stateFiles['state/conversations.json'] = JSON.stringify(state.conversations, null, 2);
        if (state.context) stateFiles['state/context.json'] = JSON.stringify(state.context, null, 2);
        if (state.faults) stateFiles['state/faults.json'] = JSON.stringify(state.faults, null, 2);
        if (state.kernel) stateFiles['state/kernel.js'] = state.kernel;

        for (const [path, content] of Object.entries(stateFiles)) {
          const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, 'POST', {
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          });
          treeItems.push({
            path,
            mode: '100644',
            type: 'blob',
            sha: (blob as any).sha,
          });
        }
      }

      // Create tree, commit, update ref
      const stateCount = state ? Object.keys(state).length : 0;
      const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, 'POST', {
        base_tree: treeSha,
        tree: treeItems,
      });
      const msg = stateCount > 0
        ? `hermitcrab: save ${Object.keys(blocks).length} blocks + ${stateCount} state files`
        : `hermitcrab: save ${Object.keys(blocks).length} blocks`;
      const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, 'POST', {
        message: msg,
        tree: (newTree as any).sha,
        parents: [mainSha],
      });
      await gh(`/repos/${owner}/${repo}/git/refs/heads/main`, 'PATCH', {
        sha: (newCommit as any).sha,
      });

      return res.status(200).json({
        success: true,
        commit: (newCommit as any).sha,
        blocks: Object.keys(blocks).length,
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}. Use list, restore, or save.` });
  } catch (error: any) {
    console.error('GitHub proxy error:', error);
    return res.status(500).json({ error: error.message || 'GitHub proxy error' });
  }
}
