#!/usr/bin/env node
/**
 * Antigravity Stop hook -> gstack Skill Contract Gate.
 * Blocks at most ONCE per turn (`continuationActive` check) when a session loaded
 * `gstack-review`, `gstack-qa`, or `gstack-investigate` and attempted to finish without its required report/evidence.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stateRoot } from './lib-paths.mjs';

function isContractsEnabled() {
  const envVal = (process.env.GSTACK_SKILL_CONTRACTS || '').trim().toLowerCase();
  if (['off', 'no', 'false', '0'].includes(envVal)) return false;
  if (['on', 'yes', 'true', '1'].includes(envVal)) return true;
  try {
    const cfg = fs.readFileSync(path.join(stateRoot(), 'config.yaml'), 'utf8');
    const m = /^skill_contracts:\s*(\S+)/m.exec(cfg);
    if (m && ['off', 'no', 'false', '0'].includes(m[1].toLowerCase())) return false;
  } catch { /* default is on */ }
  return true;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    if (!isContractsEnabled()) {
      process.stdout.write('{}\n');
      return;
    }
    const payload = JSON.parse(raw || '{}');

    if (
      payload?.continuationActive === true ||
      payload?.terminationReason !== 'NO_TOOL_CALL' ||
      payload?.fullyIdle === false
    ) {
      process.stdout.write('{}\n');
      return;
    }

    const transcriptPath = payload?.transcriptPath;
    const convId = payload?.conversationId || 'unknown';
    if (typeof transcriptPath !== 'string' || !fs.existsSync(transcriptPath)) {
      process.stdout.write('{}\n');
      return;
    }

    const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
    let lastUserIdx = -1;
    const steps = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const obj = JSON.parse(lines[i]);
        steps.push(obj);
        if (obj.type === 'USER_INPUT' && obj.source === 'USER_EXPLICIT') {
          lastUserIdx = steps.length - 1;
        }
      } catch { /* ignore */ }
    }
    if (lastUserIdx < 0) {
      process.stdout.write('{}\n');
      return;
    }

    const turnSteps = steps.slice(lastUserIdx + 1);
    let loadedSkill = null;
    let lastPlannerText = '';
    const allTexts = [];

    for (const st of turnSteps) {
      if (typeof st.content === 'string' && st.content) {
        allTexts.push(st.content);
        if (st.type === 'PLANNER_RESPONSE') lastPlannerText = st.content;
      }
      if (Array.isArray(st.tool_calls)) {
        for (const tc of st.tool_calls) {
          const p = tc?.args?.Path || tc?.arguments?.Path || '';
          if (typeof p === 'string') {
            const m = /[/\\]skills[/\\](gstack-[a-z0-9-]+)[/\\]SKILL\.md$/i.exec(p);
            if (m) loadedSkill = m[1].toLowerCase();
          }
          const tName = tc?.name || '';
          if (tName === 'ask_question' || tName === 'swarm_wait') {
            process.stdout.write('{}\n');
            return;
          }
        }
      }
    }

    if (!loadedSkill) {
      process.stdout.write('{}\n');
      return;
    }

    const trimmedLast = lastPlannerText.trim();
    if (!trimmedLast || trimmedLast.endsWith('?') || trimmedLast.endsWith('？') || /NEEDS_CONTEXT|STATUS:\s*BLOCKED/i.test(trimmedLast)) {
      process.stdout.write('{}\n');
      return;
    }

    const combined = allTexts.join('\n');
    const contractsDir = path.join(stateRoot(), 'skill-contracts');
    fs.mkdirSync(contractsDir, { recursive: true });
    const recordFile = path.join(contractsDir, `agy-${convId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
    let rec = {};
    try { rec = JSON.parse(fs.readFileSync(recordFile, 'utf8')); } catch { rec = {}; }
    const turnKey = `${lastUserIdx}:${loadedSkill}`;
    if (rec[turnKey]) {
      process.stdout.write('{}\n');
      return;
    }

    let missingReason = '';
    if (loadedSkill === 'gstack-investigate') {
      const hasRootCause = /(根因|Root\s*cause)/i.test(combined) && /(验证|Evidence|regression|回归测试)/i.test(combined);
      if (!hasRootCause) {
        missingReason = 'SKILL_CONTRACT_UNMET gstack-investigate: Before finishing, include explicit Root Cause (file:line), Hypothesis verification trail, and Regression Test execution evidence.';
      }
    } else if (loadedSkill === 'gstack-review') {
      const hasReviewVerdict = /(Pre-Landing Review:|NO FINDINGS|Nothing to review|AUTO-FIXED|NEEDS INPUT)/i.test(combined);
      if (!hasReviewVerdict) {
        missingReason = 'SKILL_CONTRACT_UNMET gstack-review: Missing structured Pre-Landing Review verdict (Pre-Landing Review: N issues / No issues found, plus Specialist Review summary when diff >= 50 lines).';
      }
    } else if (loadedSkill === 'gstack-qa') {
      const hasQaScore = /(Health Score|健康度|qa-report|Functional|Console)/i.test(combined);
      if (!hasQaScore) {
        missingReason = 'SKILL_CONTRACT_UNMET gstack-qa: Missing QA verification evidence and Health Score / contract test summary.';
      }
    }

    if (!missingReason) {
      rec[turnKey] = 'met';
      fs.writeFileSync(recordFile, JSON.stringify(rec, null, 2));
      process.stdout.write('{}\n');
      return;
    }

    rec[turnKey] = 'blocked_once';
    fs.writeFileSync(recordFile, JSON.stringify(rec, null, 2));
    process.stdout.write(JSON.stringify({
      decision: 'continue',
      reason: `${missingReason} (This gate blocks at most once per turn.)`,
    }) + '\n');
  } catch {
    process.stdout.write('{}\n');
  }
});
