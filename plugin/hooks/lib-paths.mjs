/**
 * Dynamic, zero-hardcode cross-platform path & binary discovery for Antigravity + gstack.
 * Works seamlessly on Windows (PowerShell / CMD / Git Bash), macOS, and Linux.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const IS_WIN = process.platform === 'win32';

export function homeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

export function gstackRoot() {
  return process.env.GSTACK_ROOT || path.join(homeDir(), '.gemini', 'gstack');
}

export function stateRoot() {
  return process.env.GSTACK_STATE_ROOT || process.env.GSTACK_HOME || path.join(homeDir(), '.gstack');
}

export function pluginRoot() {
  return process.env.PLUGIN_ROOT || path.join(homeDir(), '.gemini', 'config', 'plugins', 'gstack-swarm');
}

export function toPosixPath(p) {
  return p.replace(/\\/g, '/');
}

export function toMsysPath(winPath) {
  if (!IS_WIN) return winPath;
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) return winPath.replace(/\\/g, '/');
  return `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

let cachedBash = null;
export function resolveBash() {
  if (cachedBash) return cachedBash;
  if (process.env.GSTACK_GIT_BASH && fs.existsSync(process.env.GSTACK_GIT_BASH)) {
    cachedBash = process.env.GSTACK_GIT_BASH;
    return cachedBash;
  }
  if (!IS_WIN) {
    cachedBash = fs.existsSync('/opt/homebrew/bin/bash') ? '/opt/homebrew/bin/bash' : '/bin/bash';
    return cachedBash;
  }
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'D:\\Program Files\\Git\\bin\\bash.exe',
    'E:\\Program Files\\Git\\bin\\bash.exe',
    path.join(homeDir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedBash = c;
      return cachedBash;
    }
  }
  // Fallback: locate git.exe via `where.exe git` and derive ../bin/bash.exe
  const r = spawnSync('where.exe', ['git'], { encoding: 'utf8', timeout: 2000 });
  if (r.status === 0 && r.stdout) {
    for (const line of r.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
      const gitRoot = path.dirname(path.dirname(line));
      const b = path.join(gitRoot, 'bin', 'bash.exe');
      if (fs.existsSync(b)) {
        cachedBash = b;
        return cachedBash;
      }
    }
  }
  cachedBash = 'bash';
  return cachedBash;
}

let cachedBun = null;
export function resolveBun() {
  if (cachedBun) return cachedBun;
  if (process.env.BUN_EXE && fs.existsSync(process.env.BUN_EXE)) {
    cachedBun = process.env.BUN_EXE;
    return cachedBun;
  }
  const home = homeDir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const candidates = IS_WIN
    ? [
        path.join(home, '.bun', 'bin', 'bun.exe'),
        path.join(appData, 'npm', 'node_modules', 'bun', 'bin', 'bun.exe'),
        path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'bun.exe'),
        path.join(home, 'scoop', 'shims', 'bun.exe'),
      ]
    : [
        path.join(home, '.bun', 'bin', 'bun'),
        '/opt/homebrew/bin/bun',
        '/usr/local/bin/bun',
        '/usr/bin/bun',
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedBun = c;
      return cachedBun;
    }
  }
  cachedBun = IS_WIN ? 'bun.exe' : 'bun';
  return cachedBun;
}

/**
 * Builds a clean environment object with a single normalized PATH/Path key
 * (preventing duplicate Path + PATH collision in Windows Node/Bun child_process).
 */
export function buildCleanEnv(extra = {}) {
  const out = {};
  let origPath = '';
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toLowerCase() === 'path') {
      if (v) origPath = origPath ? `${origPath}${path.delimiter}${v}` : v;
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  const root = gstackRoot();
  const bashPath = resolveBash();
  const bunPath = resolveBun();
  const gitRoot = IS_WIN && path.isAbsolute(bashPath) ? path.dirname(path.dirname(bashPath)) : '';
  const appData = process.env.APPDATA || path.join(homeDir(), 'AppData', 'Roaming');

  const prepend = IS_WIN
    ? [
        path.join(root, 'bin-shim'),
        path.dirname(bunPath),
        path.join(appData, 'npm'),
        path.join(root, 'bin'),
        gitRoot && path.join(gitRoot, 'cmd'),
        gitRoot && path.join(gitRoot, 'bin'),
        gitRoot && path.join(gitRoot, 'usr', 'bin'),
      ].filter(Boolean)
    : [
        path.dirname(bunPath),
        path.join(root, 'bin'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
      ].filter(Boolean);

  const pathKey = IS_WIN ? 'Path' : 'PATH';
  out[pathKey] = [...prepend, origPath].filter(Boolean).join(path.delimiter);
  out.GSTACK_ROOT = root;
  if (IS_WIN) {
    out.GSTACK_GIT_BASH = bashPath;
    out.TMPDIR = os.tmpdir().replace(/\\/g, '/');
  }
  for (const [k, v] of Object.entries(extra)) out[k] = v;
  return out;
}
