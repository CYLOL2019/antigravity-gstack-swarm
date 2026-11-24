#!/usr/bin/env node
/**
 * Cross-platform universal `gstack` CLI dispatcher (Windows PowerShell/CMD + macOS + Linux).
 * Dynamically locates `~/.gemini/gstack`, Bun, and Git Bash without hardcoded user paths.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const IS_WIN = process.platform === 'win32';
const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
const GSTACK_ROOT = process.env.GSTACK_ROOT || path.join(HOME, '.gemini', 'gstack');
const EXE = IS_WIN ? '.exe' : '';

function resolveBash() {
  if (process.env.GSTACK_GIT_BASH && fs.existsSync(process.env.GSTACK_GIT_BASH)) return process.env.GSTACK_GIT_BASH;
  if (!IS_WIN) return fs.existsSync('/opt/homebrew/bin/bash') ? '/opt/homebrew/bin/bash' : '/bin/bash';
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'D:\\Program Files\\Git\\bin\\bash.exe',
    path.join(HOME, 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  const r = spawnSync('where.exe', ['git'], { encoding: 'utf8', timeout: 2000 });
  if (r.status === 0 && r.stdout) {
    for (const line of r.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      const b = path.join(path.dirname(path.dirname(line)), 'bin', 'bash.exe');
      if (fs.existsSync(b)) return b;
    }
  }
  return 'bash';
}

function resolveBun() {
  if (process.env.BUN_EXE && fs.existsSync(process.env.BUN_EXE)) return process.env.BUN_EXE;
  const appData = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
  const candidates = IS_WIN
    ? [
        path.join(HOME, '.bun', 'bin', 'bun.exe'),
        path.join(appData, 'npm', 'node_modules', 'bun', 'bin', 'bun.exe'),
        path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'bun.exe'),
        path.join(HOME, 'scoop', 'shims', 'bun.exe'),
      ]
    : [path.join(HOME, '.bun', 'bin', 'bun'), '/opt/homebrew/bin/bun', '/usr/local/bin/bun', '/usr/bin/bun'];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return IS_WIN ? 'bun.exe' : 'bun';
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`gstack (Antigravity Full Runtime & Swarm Edition)
Root: ${GSTACK_ROOT}

Core compiled binaries:
  gstack browse <cmd> [args...]        Headless/headed Chromium daemon (~100ms/op)
  gstack design <cmd> [args...]        Visual mockup & comparison board server
  gstack make-pdf <md> [args...]       Offline Markdown + Mermaid/Excalidraw -> PDF/HTML/DOCX
  gstack cso [args...]                 Native Chief Security Officer static/runtime auditor

Safety & Swarm hardware locks:
  gstack freeze set <dir>              Global directory edit lock (enforced by PreToolUse hook)
  gstack unfreeze                      Remove global directory edit lock
  gstack swarm-lock <subcmd>           Zero-trust per-worker /swarm file lock & session freeze

Engineering & Ledger CLIs (170+ tools in bin/):
  gstack doctor | paths | config | wtree | gate-diff | diff-scope | state-matrix
  gstack evidence | review-log | review-read | learnings-log | learnings-search
  gstack flaky | pregate | ship-preflight | ship-receipt | ship-queue | pr-wait
  gstack review-bots | issue-guard | egress | context-bill | decision-trail
  gstack worktree-audit | factory-scorecard | clean | skill-route | skill-contract
  gstack slop-diff [base]`);
  process.exit(0);
}

const sub = args[0];
const rest = args.slice(1);
const BASH_BIN = resolveBash();
const BUN_BIN = resolveBun();
const BUN_CFG = IS_WIN ? 'NUL' : '/dev/null';

function buildCleanEnv(extra = {}) {
  const out = {};
  let origPath = '';
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toLowerCase() === 'path') {
      if (v) origPath = origPath ? `${origPath}${path.delimiter}${v}` : v;
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  const gitRoot = IS_WIN && path.isAbsolute(BASH_BIN) ? path.dirname(path.dirname(BASH_BIN)) : '';
  const appData = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
  const prepend = IS_WIN
    ? [
        path.join(GSTACK_ROOT, 'bin-shim'),
        path.dirname(BUN_BIN),
        path.join(appData, 'npm'),
        path.join(GSTACK_ROOT, 'bin'),
        gitRoot && path.join(gitRoot, 'cmd'),
        gitRoot && path.join(gitRoot, 'bin'),
        gitRoot && path.join(gitRoot, 'usr', 'bin'),
      ].filter(Boolean)
    : [path.dirname(BUN_BIN), path.join(GSTACK_ROOT, 'bin'), '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean);

  out[IS_WIN ? 'Path' : 'PATH'] = [...prepend, origPath].filter(Boolean).join(path.delimiter);
  out.GSTACK_ROOT = GSTACK_ROOT;
  if (IS_WIN) {
    out.GSTACK_GIT_BASH = BASH_BIN;
    out.TMPDIR = os.tmpdir().replace(/\\/g, '/');
  }
  for (const [k, v] of Object.entries(extra)) out[k] = v;
  return out;
}

function run(bin, binArgs, extraEnv = {}) {
  const r = spawnSync(bin, binArgs, { stdio: 'inherit', env: buildCleanEnv(extraEnv) });
  if (r.error) {
    console.error(`gstack spawn error (${bin}): ${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status ?? 0);
}

function toMsysPath(winPath) {
  if (!IS_WIN) return winPath;
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) return winPath.replace(/\\/g, '/');
  return `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

if (sub === 'browse') run(path.join(GSTACK_ROOT, 'browse', 'dist', `browse${EXE}`), rest);
if (sub === 'find-browse') run(path.join(GSTACK_ROOT, 'browse', 'dist', `find-browse${EXE}`), rest);
if (sub === 'design') run(path.join(GSTACK_ROOT, 'design', 'dist', `design${EXE}`), rest);
if (sub === 'make-pdf' || sub === 'pdf') run(path.join(GSTACK_ROOT, 'make-pdf', 'dist', `pdf${EXE}`), rest);
if (sub === 'cso') {
  const csoBin = path.join(GSTACK_ROOT, 'bin', `gstack-cso-launcher${EXE}`);
  if (fs.existsSync(csoBin)) run(csoBin, rest);
  console.error(`gstack cso: native helper not built at ${csoBin}`);
  process.exit(1);
}
if (sub === 'slop-diff') run(BUN_BIN, ['--no-env-file', `--config=${BUN_CFG}`, path.join(GSTACK_ROOT, 'scripts', 'slop-diff.ts'), ...rest]);
if (sub === 'swarm-lock') run(process.execPath, [path.join(GSTACK_ROOT, 'bin', 'gstack-swarm-lock.mjs'), ...rest]);
if (sub === 'freeze') {
  const action = rest[0] === 'set' ? ['set', rest[1] || process.cwd()] : rest;
  run(BASH_BIN, [toMsysPath(path.join(GSTACK_ROOT, 'freeze', 'bin', 'freeze-state.sh')), ...action]);
}
if (sub === 'unfreeze') {
  const freezeFile = path.join(process.env.GSTACK_STATE_ROOT || process.env.GSTACK_HOME || path.join(HOME, '.gstack'), 'freeze-dir.txt');
  if (fs.existsSync(freezeFile)) fs.unlinkSync(freezeFile);
  console.log('UNFROZEN: removed freeze-dir.txt');
  process.exit(0);
}

const candidates = [
  path.join(GSTACK_ROOT, 'bin', sub.startsWith('gstack-') ? sub : `gstack-${sub}`),
  path.join(GSTACK_ROOT, 'bin', sub),
  path.join(GSTACK_ROOT, 'bin', `${sub.startsWith('gstack-') ? sub : `gstack-${sub}`}.ts`),
  path.join(GSTACK_ROOT, 'bin', `${sub.startsWith('gstack-') ? sub : `gstack-${sub}`}.sh`),
];

const target = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
if (!target) {
  console.error(`gstack: unknown subcommand "${sub}". Run "gstack --help" to list commands.`);
  process.exit(2);
}

if (fs.existsSync(`${target}${EXE}`)) run(`${target}${EXE}`, rest);

const head = fs.readFileSync(target, 'utf8').slice(0, 200);
if (target.endsWith('.ts') || /^#!.*bun\b/.test(head)) {
  run(BUN_BIN, ['--no-env-file', `--config=${BUN_CFG}`, target, ...rest]);
} else if (target.endsWith('.py') || /^#!.*python/.test(head)) {
  run(IS_WIN ? 'python' : 'python3', [target, ...rest]);
} else {
  run(BASH_BIN, [toMsysPath(target), ...rest]);
}
