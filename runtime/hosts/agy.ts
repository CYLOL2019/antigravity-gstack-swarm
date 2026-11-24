import { defineHost, GBRAIN_RESOLVERS, preambleToolGlossary, sharedRuntimeRoot } from './define-host';

// Google Antigravity 2.0 IDE + native /swarm host configuration (Full Tier):
// - Unlocks the 9-specialist parallel Review Army (Testing, Maintainability, Security, Performance,
//   Data Migration, API Contract, Design, Simplification, State Machines + Adversarial Red Team).
// - Enables enforced PreToolUse / PreInvocation / Stop lifecycle hooks via plugin hooks.json.
// - Aligns tool glossary to Antigravity 2.0 native tools and cross-platform `gstack` CLI.
const ANTIGRAVITY_TOOL_GLOSSARY = '**Antigravity 2.0 tool names & runtime:** `AskUserQuestion` means your `ask_question` tool for discrete options (or ask directly in prose for open-ended `Q<N>` questions); there is no `mcp__*__AskUserQuestion` variant. The Bash tool means `run_command` (invoke any `gstack-<cmd>` directly via `gstack <cmd> ...`, or run multi-line bash blocks via `bash -lc \'...\'` / Git Bash on Windows). The Read tool means `read_file` (returns up to 800 lines per call — pass `StartLine`/`EndLine` to read remaining ranges of long files), the Write tool means `write_file` (`Overwrite: true` when replacing), the Edit tool means `edit_file`, WebSearch means `search_web`, and the Agent tool means `invoke_subagent` (`TypeName: "self"` or `"research"`, or `"browser"` for live UI testing; inside `/swarm`, you can also dispatch `swarm{action:"add"}` workers). Load a skill by reading its `SKILL.md` with `read_file`. If a step says to call `ExitPlanMode`, present the completed plan/report to the user and wait.';

const agy = defineHost({
  name: 'agy',
  displayName: 'Antigravity',
  cliAliases: ['antigravity'],
  defaultModel: 'gemini',
  tier: 'full',
  capabilities: {
    toolExecution: true,
    questions: 'native',
    planMode: false,
    delegation: true,
    browser: true,
    safetyHooks: 'enforced',
  },

  globalRoot: '.gemini/gstack',
  localSkillRoot: '.agents/skills/gstack',
  hostSubdir: '.agy',

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: 1024,
    descriptionLimitBehavior: 'error',
    nameMatchesDirectory: true,
  },

  pathRewrites: [
    { from: 'if [ -d "$HOME/.claude/skills/gstack/.git" ]', to: 'if [ -d "$HOME/.gemini/gstack/.git" ]' },
    { from: 'INSTALL_DIR="$HOME/.claude/skills/gstack"', to: 'INSTALL_DIR="$HOME/.gemini/gstack"' },
    { from: '$HOME/.claude/skills/gstack', to: '$HOME/.gemini/gstack' },
    { from: '~/.claude/skills/gstack', to: '~/.gemini/gstack' },
    { from: '.claude/skills/gstack', to: '.agents/skills/gstack' },
    { from: '.claude/skills/review', to: '.agents/skills/gstack/review' },
    { from: '.claude/skills', to: '.agents/skills' },
    { from: 'CLAUDE.md', to: 'AGENTS.md' },
  ],
  toolRewrites: preambleToolGlossary(ANTIGRAVITY_TOOL_GLOSSARY),

  suppressedResolvers: [...GBRAIN_RESOLVERS],

  runtimeRoot: sharedRuntimeRoot(),
});

export default agy;
