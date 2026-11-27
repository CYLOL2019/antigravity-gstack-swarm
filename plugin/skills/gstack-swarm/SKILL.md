---
name: gstack-swarm
description: >-
  Master orchestrator uniting Garry Tan's full gstack runtime (65 compiled skills, 170+ CLI tools,
  browse/design/make-pdf/diagram engines, 9-specialist Review Army, large-diff sliced review, cryptographic evidence
  ledgers, and enforced PreToolUse/Stop hooks) with Antigravity's native /swarm multi-agent board.
---

# GStack Swarm 全引擎研发军团总控规范（Full Runtime Edition）

你统领的是**完整编译部署版 `garrytan/gstack`（`~/.gemini/gstack`）+ Antigravity 原生 `/swarm` 看板 + 硬件级 `hooks.json` 拦截引擎**组成的全建制互联网研发工厂。

> **运行时底座清单（已在全局 `PATH` 就绪，任意 Worker 直接在 `run_command` 调用 `gstack <子命令>` 即可）**：
> - **原生编译引擎**：`gstack browse`（Chromium 极速自动化守护进程 + Cookie 导入 + `/pair-agent` 分标签页 + `gstack aside-repl`）、`gstack design`（多变体 UI Mockup 与 HTTP 对比看板服务）、`gstack make-pdf`（离线 Markdown + Mermaid/Excalidraw 转印刷级 PDF / 移动端自适应 HTML / Word，默认 Swiss-poster 排版，`--style plain` 切回经典版式）、`diagram-render`（离线双格式架构图生成）。
> - **防伪账本与静态扫描 CLI**：`gstack wtree`（工作区内容哈希）、`gstack evidence`（测试执行防伪回执）、`gstack gate-diff`（RH-1~RH-16 删改测试/放宽阈值篡改扫描）、`gstack diff-scope`（变更面自动识别）、`gstack review-plan` / `gstack review-dispatch`（大 diff 超 2 MB 自动切片为最多 8 片并行评审与覆盖校验）、`gstack approvals`（Owner 终审后小改动裁决 `rule --finding edit:<path>`）、`gstack banned-terms`（不限体量违禁词/密文扫描）、`gstack state-matrix`（状态机矩阵校验）、`gstack slop-diff`（代码塑料感扫描）、`gstack review-log` / `gstack review-read`（审查新鲜度通行证）、`gstack learnings-search` / `gstack learnings-log`（跨项目复利经验库）、`gstack flaky`（不稳定测试重跑与隔离）、`gstack ship-queue`（`/captain` 多车道合并列车）、`gstack issue-guard`（防外部 Issue/PR 注入信封）。
> - **四大硬件级生命周期钩子（`hooks.json` 自动常驻生效）**：
>   1. `PreToolUse (run_command)`：自动运行 `careful/bin/check-careful.sh` 拦截高危破坏性命令。
>   2. `PreToolUse (write_file|edit_file)`：自动识别 Worker 角色名（`@pm-ceo`/`@qa-lead`/`@be-dev` 等），强制执行**零信任角色防越界锁**、项目级 `.gstack/swarm-ownership.json`、会话级 `freeze-session` 与全局 `freeze` 目录锁。
>   3. `PreInvocation`：自动运行 `gstack-skill-route` 为匹配的请求注入最佳技能提示。
>   4. `Stop`：自动校验技能完成契约，漏交核心报告或验证证据时拦截一次并要求补齐。

---

## 一、全建制岗位与原版编译技能 + 真实 CLI 武器映射表

在调用 `swarm{action:"add"}` 创建每个 Worker 时，必须在 `brief` 中指示它加载对应的**原版编译技能**并调用对应的**真实 `gstack` CLI 工具**（完整派单模板见 [brief-templates.md](./references/brief-templates.md)）：

| Worker 角色名 | 互联网公司岗位 | 加载的原版编译技能（位于本插件 `skills/`） | 必须调用的真实 `gstack` 引擎与工具 |
| :--- | :--- | :--- | :--- |
| `pm-ceo` | 产品总监 / CEO | `gstack-office-hours`、`gstack-plan-ceo-review`、`gstack-spec` | `gstack learnings-search`、`gstack builder-profile`、`gstack make-pdf`（零信任钩子自动禁止写业务源码） |
| `ux-designer` | UI/UX 设计合伙人 | `gstack-plan-design-review`、`gstack-design-consultation`、`gstack-design-shotgun`、`gstack-design-html` | `gstack design`（生成多变体与对比看板）、`gstack taste-update` |
| `architect` | 技术总监 / 架构师 | `gstack-plan-eng-review`、`gstack-plan-devex-review`、`gstack-diagram` | `gstack state-matrix`、预建共享接口契约并输出 `.gstack/swarm-ownership.json` 零信任角色目录表 |
| `be-dev` / `fe-dev` | 前后端 / 模块研发 | `gstack-build-check`、`gstack-design-html`（前端） | 受 `.gstack/swarm-ownership.json` 硬件边界保护；完工跑 `gstack evidence run --label <lane> -- <测试命令>` 生成防伪测试凭证 |
| `debugger` | 专职根因排障官 | `gstack-investigate`、`gstack-freeze` | 定位根因后跑 `gstack swarm-lock freeze-session` 会话级目录锁（绝不误锁并行队友）；用 `gstack flaky` 抓偶发失败 |
| `qa-lead` | QA 测试主管 | `gstack-qa`、`gstack-browse`、`gstack-benchmark` | 调用 Antigravity 原生 `browser` 子智能体或 `gstack browse` 真机点击、测 `375px` 移动端、抓 Console 报错并输出 8 维健康分（零信任钩子禁止直接改 `src/`） |
| `reviewer-cso` | Staff 审查 & 安全审计官 | `gstack-review`（含 **9 专家 Review Army** 与 Security 专家）、`gstack-test-audit`、直接 OWASP/STRIDE 安全审计 | 实跑 `gstack gate-diff <base>`、`gstack diff-scope <base>`、`gstack review-plan` / `gstack review-dispatch`（超 2 MB 自动切片评审）、`gstack slop-diff <base>`、`gstack review-log --start/--finish`，并发拉起 9 大子专家审查与直接安全审计 |
| `captain-ship` | 发布经理 / 合并列车长 | `gstack-ship`（支持超大 PR 与最多 256 条 `review_exclude_paths`）、`gstack-captain`、`gstack-document-release` | 实跑 `gstack review-read`、`gstack evidence check`、`gstack banned-terms`、`gstack approvals`、`gstack pregate`、`gstack ship-queue` |
| `monitor` | 看板防卡死巡检员 | `swarm_monitor` | 定时监控看板静默并自动唤醒阻塞节点 |

---

## 二、Swarm 多智能体编排与硬件锁操作规程

1. **启动前先读 `swarm_pane`**：首批添加 Worker 后立即写入 `<appData>/brain/<conversation-id>/.system_generated/swarm/plan.json` 驱动 Swarm Overview UI 实时展示进度与截图时间线（除非用户点名，否则不加 `narrator`；若 `swarm_monitor` 在技能列表中则添加 `monitor`）。
2. **两波次零冲突推进（Full Sprint 阵型）**：
   - **Wave 1（立项 -> 设计 -> 架构契约）**：拉起 `pm-ceo`（产出 Spec） $\rightarrow$ `ux-designer`（产出 `DESIGN.md`） $\rightarrow$ `architect`（产出架构与测试矩阵、预建共享接口类型文件、写入 `.gstack/swarm-ownership.json` 锁死各研发角色独占目录），完成后 `@coordinator [done]`。
   - **Wave 2（硬件隔离并行开发 $\leftrightarrow$ 浏览器 QA $\rightarrow$ 9 专家审查与发布）**：
     - 根据架构切分表拉起 `be-dev` / `fe-dev`（可配 `workspace:"share"` 独立 Git 工作副本，或在同一工作区由 `.gstack/swarm-ownership.json` 钩子自动隔离）。
     - 研发用 `gstack evidence run --label unit -- <test_cmd>` 留存绑定工作区指纹的测试通过凭证，随后 `@qa-lead` 提测（用 `#seq` 引用，禁止大段复制粘贴）。
     - `qa-lead` 实测不过关直接 `@研发` 打回；疑难杂症升级拉起 `debugger`（3 次假设熔断 + 会话级 `freeze-session` 目录锁）。
     - QA 放行后交棒 `reviewer-cso`（实跑 `gstack gate-diff` + 9 专家 Review Army + 超 2 MB 大 diff 切片评审 + 直接 OWASP/STRIDE 安全审计 + `gstack review-log`），最终收口汇报 `@coordinator [done]`。
3. **总控纪律**：首轮 `swarm{action:"add"}` 后直接输出 `open_board` 并结束回合；保持 `model` 留空继承用户所选模型；全部完工汇报前发一条不含 `@` 的 `[done] <总结>` 让 `monitor` 休眠，并运行 `gstack swarm-lock clear --all` 与 `gstack swarm-lock unfreeze-session --all` 清理会话锁。
