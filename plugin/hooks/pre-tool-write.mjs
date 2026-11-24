#!/usr/bin/env node
/**
 * Antigravity PreToolUse hook for `write_file` & `edit_file`:
 *   1. Enforces Zero-Trust Swarm Role Guards, `.gstack/swarm-ownership.json`, per-worker locks, and session-scoped freeze.
 *   2. Enforces global `gstack freeze` boundary (`~/.gstack/freeze-dir.txt`) via `freeze/bin/check-freeze.sh` (fail-closed).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCleanEnv, gstackRoot, homeDir, resolveBash, stateRoot, toMsysPath } from './lib-paths.mjs';

async function loadSwarmChecker() {
  const installedLock = path.join(gstackRoot(), 'bin', 'gstack-swarm-lock.mjs');
  const repoFallback = path.resolve(import.meta.dirname, '..', '..', 'runtime', 'bin', 'gstack-swarm-lock.mjs');
  const target = fs.existsSync(installedLock) ? installedLock : repoFallback;
  return import(pathToFileURL(target).href);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(raw || '{}');
    const filePath = payload?.toolCall?.args?.Path;
    if (typeof filePath !== 'string' || !filePath) {
      process.stdout.write('{"decision":"allow"}\n');
      return;
    }

    const cwd = payload?.cwd || process.cwd();
    const conversationId = payload?.conversationId || '';
    const transcriptPath = payload?.transcriptPath || '';

    // 1. Check Swarm role ownership & session-scoped freeze
    const { checkSwarmOwnership } = await loadSwarmChecker();
    const swarmRes = checkSwarmOwnership({ conversationId, transcriptPath, filePath, cwd });
    if (!swarmRes.allowed) {
      process.stdout.write(JSON.stringify({ decision: 'deny', reason: swarmRes.reason }) + '\n');
      return;
    }

    // 2. Fast-path allow if no global /freeze boundary file is active
    const freezeFile = path.join(stateRoot(), 'freeze-dir.txt');
    if (!fs.existsSync(freezeFile)) {
      process.stdout.write('{"decision":"allow"}\n');
      return;
    }

    // Always permit Antigravity brain/artifact writes
    const brainRoot = path.join(homeDir(), '.gemini', 'antigravity', 'brain').toLowerCase();
    const resolvedTarget = path.resolve(cwd, filePath).toLowerCase();
    if (resolvedTarget.startsWith(brainRoot + path.sep)) {
      process.stdout.write('{"decision":"allow"}\n');
      return;
    }

    const checkFreeze = path.join(gstackRoot(), 'freeze', 'bin', 'check-freeze.sh');
    if (!fs.existsSync(checkFreeze)) {
      process.stdout.write('{"decision":"deny","reason":"[gstack freeze] check-freeze.sh missing while freeze-dir.txt is active (fail closed)."}\n');
      return;
    }

    const claudeShaped = JSON.stringify({
      tool_name: payload?.toolCall?.name === 'edit_file' ? 'Edit' : 'Write',
      cwd,
      tool_input: { file_path: filePath },
    });

    const r = spawnSync(resolveBash(), [toMsysPath(checkFreeze)], {
      input: claudeShaped,
      encoding: 'utf8',
      timeout: 8000,
      env: buildCleanEnv(),
    });

    const out = (r.stdout || '').trim();
    if (!out || out === '{}') {
      process.stdout.write('{"decision":"allow"}\n');
      return;
    }
    const parsed = JSON.parse(out);
    if (parsed?.hookSpecificOutput?.permissionDecision === 'deny') {
      process.stdout.write(JSON.stringify({
        decision: 'deny',
        reason: parsed.hookSpecificOutput.permissionDecisionReason || '[gstack freeze] File outside frozen directory.',
      }) + '\n');
      return;
    }
    process.stdout.write('{"decision":"allow"}\n');
  } catch (err) {
    const freezeActive = fs.existsSync(path.join(stateRoot(), 'freeze-dir.txt'));
    if (freezeActive) {
      process.stdout.write(JSON.stringify({
        decision: 'deny',
        reason: `[gstack freeze] Hook error while freeze is active (fail closed): ${err instanceof Error ? err.message : String(err)}`,
      }) + '\n');
    } else {
      process.stdout.write('{"decision":"allow"}\n');
    }
  }
});
