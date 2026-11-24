#!/usr/bin/env node
/**
 * Antigravity PreInvocation hook -> gstack deterministic skill router (`lib/skill-route.ts`).
 * Portable across Windows, macOS, and Linux (zero hardcoded user paths).
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IS_WIN, buildCleanEnv, gstackRoot, pluginRoot, resolveBun, stateRoot } from './lib-paths.mjs';

function isRoutingEnabled() {
  const envVal = (process.env.GSTACK_SKILL_ROUTING || '').trim().toLowerCase();
  if (['off', 'no', 'false', '0'].includes(envVal)) return false;
  if (['on', 'yes', 'true', '1'].includes(envVal)) return true;
  try {
    const cfg = fs.readFileSync(path.join(stateRoot(), 'config.yaml'), 'utf8');
    const m = /^skill_routing:\s*(\S+)/m.exec(cfg);
    if (m && ['off', 'no', 'false', '0'].includes(m[1].toLowerCase())) return false;
  } catch { /* default is on */ }
  return true;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    if (!isRoutingEnabled()) {
      process.stdout.write('{}\n');
      return;
    }
    const payload = JSON.parse(raw || '{}');
    const prompt = typeof payload?.lastUserInput === 'string' ? payload.lastUserInput.trim() : '';
    const convId = typeof payload?.conversationId === 'string' ? payload.conversationId : 'default';

    if (!prompt || prompt.startsWith('/') || prompt.startsWith('<SYSTEM_MESSAGE>') || prompt.includes('<cross-session-message')) {
      process.stdout.write('{}\n');
      return;
    }

    const root = gstackRoot();
    const routeBin = path.join(root, 'bin', 'gstack-skill-route');
    if (!fs.existsSync(routeBin)) {
      process.stdout.write('{}\n');
      return;
    }

    const hooksDir = path.join(stateRoot(), 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    const seenFile = path.join(hooksDir, 'agy-routed-turns.json');
    const hash = crypto.createHash('sha1').update(`${convId}:${prompt}`).digest('hex').slice(0, 16);
    let seen = {};
    try { seen = JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch { seen = {}; }
    if (seen[convId] === hash) {
      process.stdout.write('{}\n');
      return;
    }

    const bunCfg = IS_WIN ? 'NUL' : '/dev/null';
    const r = spawnSync(resolveBun(), ['--no-env-file', `--config=${bunCfg}`, routeBin, '--explain', prompt, '--json'], {
      encoding: 'utf8',
      timeout: 3000,
      env: buildCleanEnv({ GSTACK_INSTALLED_SKILLS_DIR: root }),
    });

    if (r.status !== 0 || !r.stdout) {
      process.stdout.write('{}\n');
      return;
    }
    const res = JSON.parse(r.stdout);
    const routeName = res?.route?.skill || res?.route;
    if (!routeName || typeof routeName !== 'string') {
      process.stdout.write('{}\n');
      return;
    }

    const normalized = routeName.replace(/^\//, '');
    const agySkillName = normalized.startsWith('gstack-') ? normalized : `gstack-${normalized}`;
    const skillMdPath = path.join(pluginRoot(), 'skills', agySkillName, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      process.stdout.write('{}\n');
      return;
    }

    seen[convId] = hash;
    const keys = Object.keys(seen);
    if (keys.length > 100) delete seen[keys[0]];
    fs.writeFileSync(seenFile, JSON.stringify(seen));

    fs.appendFileSync(
      path.join(hooksDir, 'skill-route.log'),
      `${new Date().toISOString()} session=${convId} event=routed skill=${agySkillName} host=antigravity\n`
    );

    const msg = `[gstack skill routing] This request matches the "${agySkillName}" workflow. Read "${skillMdPath}" with read_file and follow its procedure (disable via: gstack config set skill_routing off).`;
    process.stdout.write(JSON.stringify({
      injectSteps: [{ systemMessage: { systemMessage: msg } }],
    }) + '\n');
  } catch {
    process.stdout.write('{}\n');
  }
});
