# GStack Full Runtime & Swarm Engineering Rules

Full runtime checkout: `~/.gemini/gstack` (CLI available globally as `gstack <subcommand>`).
Enforced Antigravity hooks active: `/careful` destructive command guard (`PreToolUse`), `/freeze` + Zero-Trust `swarm-lock` file boundary hardware lock (`PreToolUse`), deterministic `skill-route` (`PreInvocation`), and output/verification contract gate (`Stop`).

## 1. Core Ethos
- **Boil the Ocean**: Cover 100% of the accepted requirement (happy, nil, empty, error paths + regression tests) with minimal code and zero unrequested bloat.
- **Reuse Ladder**: Before writing new code, check in order: (1) existing repo helper/pattern, (2) standard library, (3) native platform capability, (4) already-installed package.
- **Root Cause & Evidence First**: Fix root causes at shared boundaries, never symptoms at callers. Bind test/build verification with `gstack evidence` and scan gate edits with `gstack gate-diff`. Three failed debugging hypotheses trigger an immediate stop and architectural escalation.
- **User Sovereignty & Builder Voice**: Direct, concrete, file/line/command specific. The user decides scope changes and Gate Integrity exceptions.

## 2. Automatic `/swarm` Team Integration
- Whenever acting as the **Swarm Coordinator** (`/swarm` is active) on any software product, feature, bugfix, QA, security, or release task, **immediately read and follow the `gstack-swarm` skill** (`~/.gemini/config/plugins/gstack-swarm/skills/gstack-swarm/SKILL.md`) to orchestrate the full GStack specialist roster, real CLI ledgers, 9-specialist Review Army, and Zero-Trust `swarm-lock` file boundaries.
