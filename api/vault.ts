import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Vault — unified service proxy.
 *
 * Routes by `service` field in request body. Key resolution order:
 *   1. Vercel env vars (VAULT_KEY_CLAUDE, VAULT_KEY_GITHUB) — server-wide
 *   2. httpOnly cookies (hc_claude, hc_github) — per-user, JS-invisible
 *   3. Request headers (X-API-Key, X-GitHub-Token) — legacy fallback
 *
 * The `set-keys` service stores keys as httpOnly cookies. JavaScript on the
 * page cannot read, modify, or intercept them. The browser sends them
 * automatically with every same-origin request to /api/vault.
 */

const ALLOWED_ORIGINS = [
  'https://idiothuman.com',
  'https://www.idiothuman.com',
  'https://hermitcrab.me',
  'https://www.hermitcrab.me',
  'http://localhost:5173',
  'http://localhost:3000',
];

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.some(a => origin.startsWith(a))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-GitHub-Token');
}

// ── Cookie helpers ──
function parseCookies(req: VercelRequest): Record<string, string> {
  const raw = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }
  return cookies;
}

function cookieFlags(req: VercelRequest): string {
  const isSecure = !req.headers.host?.includes('localhost');
  return `HttpOnly; SameSite=Lax; Path=/api/vault; Max-Age=31536000${isSecure ? '; Secure' : ''}`;
}

// ── GitHub helper ──
function ghFetch(token: string) {
  return async (path: string, method = 'GET', body?: unknown) => {
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
}

// ── Service: Claude ──
async function handleClaude(req: VercelRequest, res: VercelResponse) {
  const cookies = parseCookies(req);
  const apiKey = process.env.VAULT_KEY_CLAUDE
    || cookies.hc_claude                    // httpOnly cookie (per-user)
    || req.headers['x-api-key'] as string   // legacy header fallback
    || req.body.apiKey;
  if (!apiKey) return res.status(400).json({ error: 'No Claude API key. Use setup page or set VAULT_KEY_CLAUDE env var.' });
  if (!apiKey.startsWith('sk-ant-')) return res.status(400).json({ error: 'Invalid API key format' });

  const { service: _s, apiKey: _ak, ...rest } = req.body;
  const { model, max_tokens, system, messages, tools, tool_choice, thinking,
          temperature, top_p, top_k, stop_sequences, metadata } = rest;

  const body: Record<string, unknown> = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 4096,
    messages,
  };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;
  if (thinking) body.thinking = thinking;
  if (temperature !== undefined) body.temperature = temperature;
  if (top_p !== undefined) body.top_p = top_p;
  if (top_k !== undefined) body.top_k = top_k;
  if (stop_sequences) body.stop_sequences = stop_sequences;
  if (metadata) body.metadata = metadata;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'context-management-2025-06-27',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}

// ── Service: GitHub ──
async function handleGitHub(req: VercelRequest, res: VercelResponse) {
  const cookies = parseCookies(req);
  const token = process.env.VAULT_KEY_GITHUB
    || cookies.hc_github                     // httpOnly cookie (per-user)
    || req.headers['x-github-token'] as string;  // legacy header fallback
  if (!token) return res.status(400).json({ error: 'No GitHub token. Use setup page or set VAULT_KEY_GITHUB env var.' });

  const { action, owner, repo, blocks, state, path: filePath, content: fileContent, message: commitMessage } = req.body;

  const gh = ghFetch(token);

  // ── WHOAMI ── (no owner/repo needed)
  if (action === 'whoami') {
    const user = await gh('/user');
    return res.status(200).json({ login: (user as any).login });
  }

  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo required' });
  }

  // ── LIST ──
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

  // ── RESTORE ──
  if (action === 'restore') {
    const contents = await gh(`/repos/${owner}/${repo}/contents/blocks`);
    const result: Record<string, unknown> = {};
    for (const file of (contents as any[])) {
      if (!file.name.endsWith('.json')) continue;
      const name = file.name.replace('.json', '');
      const fileData = await gh(`/repos/${owner}/${repo}/contents/blocks/${file.name}`);
      const raw = Buffer.from((fileData as any).content, 'base64').toString('utf-8');
      try { result[name] = JSON.parse(raw); } catch { result[name] = raw; }
    }

    const stateResult: Record<string, unknown> = {};
    try {
      const stateContents = await gh(`/repos/${owner}/${repo}/contents/state`);
      for (const file of (stateContents as any[])) {
        const fileData = await gh(`/repos/${owner}/${repo}/contents/state/${file.name}`);
        const raw = Buffer.from((fileData as any).content, 'base64').toString('utf-8');
        const key = file.name.replace(/\.(json|txt|js|enc)$/, '');
        if (file.name.endsWith('.json')) {
          try { stateResult[key] = JSON.parse(raw); } catch { stateResult[key] = raw; }
        } else {
          stateResult[key] = raw;
        }
      }
    } catch (e: any) {
      if (!e.message.includes('404')) throw e;
    }

    return res.status(200).json({
      blocks: result,
      state: Object.keys(stateResult).length > 0 ? stateResult : undefined,
      count: Object.keys(result).length,
    });
  }

  // ── SAVE ──
  if (action === 'save') {
    if (!blocks || typeof blocks !== 'object') {
      return res.status(400).json({ error: 'blocks object required for save' });
    }

    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/main`);
    const mainSha = (ref as any).object.sha;
    const commit = await gh(`/repos/${owner}/${repo}/git/commits/${mainSha}`);
    const treeSha = (commit as any).tree.sha;

    const treeItems: any[] = [];
    for (const [name, block] of Object.entries(blocks)) {
      const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, 'POST', {
        content: Buffer.from(JSON.stringify(block, null, 2)).toString('base64'),
        encoding: 'base64',
      });
      treeItems.push({ path: `blocks/${name}.json`, mode: '100644', type: 'blob', sha: (blob as any).sha });
    }

    if (state && typeof state === 'object') {
      const stateFiles: Record<string, string> = {};
      if (state.jsx) stateFiles['state/jsx.txt'] = state.jsx;
      if (state.conversations) stateFiles['state/conversations.json'] = JSON.stringify(state.conversations, null, 2);
      if (state.context) stateFiles['state/context.json'] = JSON.stringify(state.context, null, 2);
      if (state.faults) stateFiles['state/faults.json'] = JSON.stringify(state.faults, null, 2);
      if (state.kernel) stateFiles['state/kernel.js'] = state.kernel;
      if (state.secrets) stateFiles['state/secrets.enc'] = state.secrets;

      for (const [path, content] of Object.entries(stateFiles)) {
        const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, 'POST', {
          content: Buffer.from(content).toString('base64'),
          encoding: 'base64',
        });
        treeItems.push({ path, mode: '100644', type: 'blob', sha: (blob as any).sha });
      }
    }

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

  // ── COMMIT (individual file) ──
  if (action === 'commit') {
    if (!filePath || !fileContent) {
      return res.status(400).json({ error: 'path and content required for commit' });
    }
    const apiBase = `/repos/${owner}/${repo}/contents/${filePath}`;
    let sha: string | undefined;
    try {
      const existing = await gh(apiBase);
      sha = (existing as any).sha;
    } catch {}
    const body: Record<string, unknown> = {
      message: commitMessage || `hermitcrab: update ${filePath}`,
      content: Buffer.from(fileContent).toString('base64'),
    };
    if (sha) body.sha = sha;
    const result = await gh(apiBase, 'PUT', body);
    return res.status(200).json({
      success: true,
      path: filePath,
      sha: (result as any).content?.sha,
    });
  }

  return res.status(400).json({ error: `Unknown GitHub action: ${action}. Use whoami, list, restore, save, or commit.` });
}

// ── Service: set-keys (stores as httpOnly cookies — JS-invisible) ──
async function handleSetKeys(req: VercelRequest, res: VercelResponse) {
  const { claude, github } = req.body;
  if (!claude && !github) return res.status(400).json({ error: 'Provide claude and/or github key' });
  const flags = cookieFlags(req);
  const setCookies: string[] = [];
  const stored: string[] = [];
  if (claude) { setCookies.push(`hc_claude=${claude}; ${flags}`); stored.push('claude'); }
  if (github) { setCookies.push(`hc_github=${github}; ${flags}`); stored.push('github'); }
  res.setHeader('Set-Cookie', setCookies);
  return res.status(200).json({ success: true, stored });
}

// ── Service: encrypt-keys (reads httpOnly cookies, encrypts with passphrase) ──
// Returns encrypted blob for the kernel to persist (e.g. in github state).
// AES-256-GCM with scrypt key derivation.
async function handleEncryptKeys(req: VercelRequest, res: VercelResponse) {
  const { passphrase } = req.body;
  if (!passphrase || passphrase.length < 6) {
    return res.status(400).json({ error: 'Passphrase required (min 6 chars)' });
  }
  const cookies = parseCookies(req);
  const keys: Record<string, string> = {};
  if (cookies.hc_claude) keys.claude = cookies.hc_claude;
  if (cookies.hc_github) keys.github = cookies.hc_github;
  if (Object.keys(keys).length === 0) {
    return res.status(400).json({ error: 'No keys in cookies to encrypt' });
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derived = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', derived, iv);
  let encrypted = cipher.update(JSON.stringify(keys), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  const blob = JSON.stringify({
    v: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted,
  });
  return res.status(200).json({ encrypted: blob });
}

// ── Service: decrypt-keys (decrypts blob, sets httpOnly cookies) ──
// Used during rehydration: kernel sends encrypted blob + passphrase,
// vault decrypts and sets cookies. Keys never touch JavaScript.
async function handleDecryptKeys(req: VercelRequest, res: VercelResponse) {
  const { passphrase, encrypted } = req.body;
  if (!passphrase) return res.status(400).json({ error: 'Passphrase required' });
  if (!encrypted) return res.status(400).json({ error: 'Encrypted blob required' });
  try {
    const blob = JSON.parse(encrypted);
    if (blob.v !== 1) return res.status(400).json({ error: 'Unknown encryption version' });
    const salt = Buffer.from(blob.salt, 'base64');
    const iv = Buffer.from(blob.iv, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const derived = scryptSync(passphrase, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', derived, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(blob.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    const keys = JSON.parse(decrypted);
    const flags = cookieFlags(req);
    const setCookies: string[] = [];
    const restored: string[] = [];
    if (keys.claude) { setCookies.push(`hc_claude=${keys.claude}; ${flags}`); restored.push('claude'); }
    if (keys.github) { setCookies.push(`hc_github=${keys.github}; ${flags}`); restored.push('github'); }
    if (setCookies.length > 0) res.setHeader('Set-Cookie', setCookies);
    return res.status(200).json({ success: true, restored });
  } catch {
    return res.status(400).json({ error: 'Decryption failed — wrong passphrase?' });
  }
}

// ── Main handler ──
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { service } = req.body;
  if (!service) return res.status(400).json({ error: 'service field required (e.g. "claude", "github")' });

  try {
    switch (service) {
      case 'claude': return await handleClaude(req, res);
      case 'github': return await handleGitHub(req, res);
      case 'set-keys': return await handleSetKeys(req, res);
      case 'encrypt-keys': return await handleEncryptKeys(req, res);
      case 'decrypt-keys': return await handleDecryptKeys(req, res);
      default: return res.status(400).json({ error: `Unknown service: ${service}. Available: claude, github, set-keys, encrypt-keys, decrypt-keys.` });
    }
  } catch (error: any) {
    console.error(`Vault error (${service}):`, error);
    return res.status(500).json({ error: error.message || 'Vault proxy error' });
  }
}
