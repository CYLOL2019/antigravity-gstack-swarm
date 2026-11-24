#!/usr/bin/env node
/**
 * gstack-swarm-lock — Zero-Trust Hardware File-Ownership & Session-Freeze Engine for Antigravity /swarm.
 *
 * Capabilities:
 *   1. Explicit per-conversation locks: `~/.gstack/swarm-locks/<conversationId>.json`
 *   2. Automatic `/swarm` worker identity detection from Antigravity `transcriptPath` (`@pm-ceo`, `@qa-lead`, `@be-dev`, etc.)
 *   3. Project-level role ownership table: `<cwd>/.gstack/swarm-ownership.json`
 *   4. Built-in Zero-Trust Swarm Role Invariants:
 *      - `pm-ceo` / `pm-*`: cannot edit implementation code (`*.ts/js/py/go/rs/java/...`).
 *      - `qa-lead` / `qa-*` / `reviewer-*`: Verifiers can write `.gstack/**` and `tests/**`, never `src/**` product code.
 *   5. Session-scoped `/freeze` (`~/.gstack/freeze-sessions/<conversationId>.txt`) so parallel Swarm workers never freeze each other.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export function stateRoot() {
  return process.env.GSTACK_STATE_ROOT || process.env.GSTACK_HOME || path.join(os.homedir(), '.gstack');
}

function locksDir() {
  const d = path.join(stateRoot(), 'swarm-locks');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function freezeSessionsDir() {
  const d = path.join(stateRoot(), 'freeze-sessions');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function normalizePosix(p, baseDir = process.cwd()) {
  const resolved = path.resolve(baseDir, p).replace(/\\/g, '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function globToRegExp(globPattern, baseDir) {
  let g = globPattern.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(g) && !/^[a-zA-Z]:\//.test(g)) {
    g = normalizePosix(path.join(baseDir, g));
  } else {
    g = normalizePosix(g);
  }
  if (g.endsWith('/')) g += '**';
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___GLOBSTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/___GLOBSTAR___/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function detectSwarmWorkerRole(conversationId, transcriptPath) {
  if (!conversationId || !transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const cacheFile = path.join(locksDir(), '.role-cache.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
  if (Object.hasOwn(cache, conversationId)) return cache[conversationId];

  let detected = null;
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(16384);
    const bytes = fs.readSync(fd, buf, 0, 16384, 0);
    fs.closeSync(fd);
    const head = buf.subarray(0, bytes).toString('utf8');
    const m = /(?:^|\n|"content"\s*:\s*"[^"]*?)@([a-z0-9][a-z0-9_-]{1,23})\b/i.exec(head);
    if (m) {
      const candidate = m[1].toLowerCase();
      if (!['coordinator', 'all', 'narrator', 'monitor'].includes(candidate)) {
        if (/swarm_worker|read_board|post_message|【任务目标】|【核心职责】|You own /i.test(head)) {
          detected = candidate;
        }
      }
    }
  } catch { /* ignore */ }

  cache[conversationId] = detected;
  try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch { /* ignore */ }
  return detected;
}

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs|c|cpp|h|hpp|vue|svelte|rb|php|swift)$/i;

function applyRule(rule, workerLabel, normFile, rawPath, baseDir) {
  const ruleBase = rule.cwd || baseDir;
  const denies = Array.isArray(rule.deny) ? rule.deny : [];
  for (const d of denies) {
    if (globToRegExp(d, ruleBase).test(normFile)) {
      return {
        allowed: false,
        reason: `[gstack-swarm-lock] Blocked: Swarm worker "@${workerLabel}" is forbidden from editing "${rawPath}" (matches deny "${d}"). Post on the swarm board to coordinate with the owning worker or @coordinator.`,
      };
    }
  }
  const allows = Array.isArray(rule.allow) ? rule.allow : [];
  if (allows.length > 0) {
    const matched = allows.some(a => globToRegExp(a, ruleBase).test(normFile));
    if (!matched) {
      return {
        allowed: false,
        reason: `[gstack-swarm-lock] Blocked: "${rawPath}" is outside Swarm worker "@${workerLabel}"'s owned paths [${allows.join(', ')}]. Coordinate via @coordinator on the swarm board.`,
      };
    }
  }
  return { allowed: true };
}

export function checkSwarmOwnership({ conversationId, transcriptPath, filePath, cwd }) {
  if (!filePath) return { allowed: true };
  const baseDir = cwd || process.cwd();
  const normFile = normalizePosix(filePath, baseDir);

  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const appData = normalizePosix(path.join(home, '.gemini', 'antigravity', 'brain'));
  const gstackState = normalizePosix(stateRoot());
  if (normFile.startsWith(appData + '/') || normFile.startsWith(gstackState + '/')) {
    return { allowed: true };
  }

  // 1. Session-scoped /freeze (`~/.gstack/freeze-sessions/<conversationId>.txt`)
  if (conversationId) {
    const sessFreeze = path.join(stateRoot(), 'freeze-sessions', `${conversationId.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`);
    if (fs.existsSync(sessFreeze)) {
      const frozenDir = normalizePosix(fs.readFileSync(sessFreeze, 'utf8').trim(), baseDir).replace(/\/+$/, '');
      if (frozenDir && normFile !== frozenDir && !normFile.startsWith(frozenDir + '/')) {
        return {
          allowed: false,
          reason: `[gstack session-freeze] Blocked: "${filePath}" is outside this session's frozen directory "${frozenDir}". Run "gstack swarm-lock unfreeze-session --session ${conversationId}" when done.`,
        };
      }
    }
  }

  // 2. Explicit per-conversation Swarm lock
  const dir = path.join(stateRoot(), 'swarm-locks');
  if (conversationId && fs.existsSync(dir)) {
    const lockFile = path.join(dir, `${conversationId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
    if (fs.existsSync(lockFile)) {
      let rule;
      try { rule = JSON.parse(fs.readFileSync(lockFile, 'utf8')); }
      catch { return { allowed: false, reason: `[gstack-swarm-lock] Corrupt lock file ${lockFile} (fail closed).` }; }
      return applyRule(rule, rule.worker || conversationId, normFile, filePath, baseDir);
    }
  }

  // 3. Auto-detect Swarm worker role from transcriptPath + project `.gstack/swarm-ownership.json`
  const role = detectSwarmWorkerRole(conversationId, transcriptPath);
  if (!role) return { allowed: true };

  const repoOwnershipFile = path.join(baseDir, '.gstack', 'swarm-ownership.json');
  if (fs.existsSync(repoOwnershipFile)) {
    try {
      const map = JSON.parse(fs.readFileSync(repoOwnershipFile, 'utf8'));
      const roleRule = map[role] || map[`@${role}`];
      if (roleRule) return applyRule(roleRule, role, normFile, filePath, baseDir);
    } catch {
      return { allowed: false, reason: `[gstack-swarm-lock] Corrupt ${repoOwnershipFile} (fail closed).` };
    }
  }

  // 4. Built-in Zero-Trust Role Invariants
  if (role === 'pm-ceo' || role.startsWith('pm-')) {
    if (CODE_EXT_RE.test(normFile)) {
      return {
        allowed: false,
        reason: `[gstack-swarm-lock] Zero-Trust Role Guard: "@${role}" is a Product/CEO role and cannot edit implementation code ("${filePath}"). Write PRD/Specs only and hand off to @architect / @dev.`,
      };
    }
  } else if (role === 'qa-lead' || role.startsWith('qa-') || role === 'reviewer-cso' || role.startsWith('reviewer')) {
    if (/\/(src|app|server|client|components|pages|controllers|services|models)\//i.test(normFile) && !/\.(test|spec)\./i.test(normFile)) {
      return {
        allowed: false,
        reason: `[gstack-swarm-lock] Zero-Trust Verifier Guard: "@${role}" is a Verifier and must not directly edit product source "${filePath}" (prevents two-worker file collision). Report the bug on the board and @mention the owning developer or @debugger!`,
      };
    }
  }

  return { allowed: true };
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    }
  }
  return out;
}

const isMain = process.argv[1] && (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1].endsWith('gstack-swarm-lock.mjs'));
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (cmd === 'set') {
    const id = String(flags.id || process.env.ANTIGRAVITY_CONVERSATION_ID || '');
    if (!id) { console.error('Usage: gstack swarm-lock set --id <conversationId> --allow "dir1/**,dir2/**" [--deny "dir3/**"] [--worker <name>] [--cwd <dir>]'); process.exit(2); }
    const allow = flags.allow ? String(flags.allow).split(',').map(s => s.trim()).filter(Boolean) : [];
    const deny = flags.deny ? String(flags.deny).split(',').map(s => s.trim()).filter(Boolean) : [];
    const record = {
      id,
      worker: flags.worker || id,
      cwd: path.resolve(String(flags.cwd || process.cwd())),
      allow,
      deny,
      updatedAt: new Date().toISOString(),
    };
    const f = path.join(locksDir(), `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
    fs.writeFileSync(f, JSON.stringify(record, null, 2));
    console.log(`SWARM_LOCK_SET: ${f} (allow=${allow.join('|') || '*'} deny=${deny.join('|') || 'none'})`);
  } else if (cmd === 'freeze-session') {
    const id = String(flags.session || flags.id || '');
    const targetDir = String(flags.dir || rest[0] || process.cwd());
    if (!id) { console.error('Usage: gstack swarm-lock freeze-session --session <conversationId> --dir <path>'); process.exit(2); }
    const f = path.join(freezeSessionsDir(), `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`);
    fs.writeFileSync(f, path.resolve(targetDir) + '\n');
    console.log(`SESSION_FREEZE_SET: session=${id} dir=${path.resolve(targetDir)}`);
  } else if (cmd === 'unfreeze-session') {
    const id = String(flags.session || flags.id || '');
    if (flags.all) {
      for (const e of fs.readdirSync(freezeSessionsDir())) fs.unlinkSync(path.join(freezeSessionsDir(), e));
      console.log('SESSION_FREEZE_CLEARED: all');
    } else if (id) {
      const f = path.join(freezeSessionsDir(), `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`);
      if (fs.existsSync(f)) fs.unlinkSync(f);
      console.log(`SESSION_FREEZE_CLEARED: ${id}`);
    }
  } else if (cmd === 'clear') {
    const dir = locksDir();
    if (flags.all) {
      for (const e of fs.readdirSync(dir)) if (e.endsWith('.json')) fs.unlinkSync(path.join(dir, e));
      console.log('SWARM_LOCK_CLEARED: all');
    } else if (flags.id) {
      const f = path.join(dir, `${String(flags.id).replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
      if (fs.existsSync(f)) fs.unlinkSync(f);
      console.log(`SWARM_LOCK_CLEARED: ${flags.id}`);
    } else {
      console.error('Usage: gstack swarm-lock clear --id <id> | --all'); process.exit(2);
    }
  } else if (cmd === 'list') {
    const dir = locksDir();
    const files = fs.readdirSync(dir).filter(e => e.endsWith('.json') && !e.startsWith('.'));
    if (!files.length) console.log('SWARM_LOCKS: none');
    for (const f of files) {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      console.log(`${r.id}\tworker=${r.worker}\tallow=[${(r.allow || []).join(', ')}]\tdeny=[${(r.deny || []).join(', ')}]\tcwd=${r.cwd}`);
    }
  } else if (cmd === 'check') {
    const res = checkSwarmOwnership({
      conversationId: String(flags.id || ''),
      transcriptPath: flags.transcript ? String(flags.transcript) : undefined,
      filePath: String(flags.file || ''),
      cwd: flags.cwd ? String(flags.cwd) : process.cwd(),
    });
    console.log(JSON.stringify(res));
    process.exit(res.allowed ? 0 : 1);
  } else {
    console.log('Commands: set | clear | list | check | freeze-session | unfreeze-session');
  }
}
