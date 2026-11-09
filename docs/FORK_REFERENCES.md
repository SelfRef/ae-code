# Fork references

Other forks of [pingdotgg/t3code](https://github.com/pingdotgg/t3code) and what each adds on top of upstream, kept as
a source of ideas and code to port. What this fork does itself is in [FORK_CHANGES.md](./FORK_CHANGES.md); it links
here for where an idea came from. Snapshot of 2026-11-09.

**How this was gathered.** GitHub lists about 10,100 forks of upstream. Two surveys feed this file, both on 2026-11-09.
The first took the 400 with the most stars, compared each with upstream's `main`, and read the commits that about 85
recently active ones added themselves (a GitHub `compare` against upstream's `main`, minus merges, syncs and commits
that carry a `(#NNNN)` pull request number); it measured single commits in lines and files and checked each idea against
upstream with a keyword search. The second re-read READMEs and commit subjects of the larger forks. The list is still
not complete: a fork with one star and no description is easy to miss (E4 Code was missed on the second pass).
**Code was read only where an entry says so.** A feature line is a claim from a README or a commit subject until then,
and a size is the commit's size on the fork's own, older base, so a port costs somewhat more.

- GitHub's "ahead" and "behind" counts are useless for forks that rewrote history or merge upstream: some show
  thousands of commits ahead. They are left out.
- Upstream is MIT. Porting is fine if the fork's licence allows it and authorship is kept; the licence is given where
  checked. A fork that is far behind upstream cannot be cherry-picked, so ports are rewrites of the idea on current
  `main`.
- A fork is only worth a look if it adds something upstream does not have. Upstream ships fast; features such as voice
  input, `t3 thread`, scheduled sends, provider handoff, Mermaid and LaTeX rendering were fork-only (in MT Code, by its
  README) and are now upstream's.

## Feature index

What is wanted, who has it, and what this fork does about it. "Planned" and "done" refer to rows in
[FORK_CHANGES.md](./FORK_CHANGES.md).

| Feature                                                           | Forks                                   | Here                                                         |
| ----------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| Manage MCP servers from Settings                                  | E4 Code, MT Code (plugin marketplace)   | planned, change 16                                           |
| Self-hosted Android push                                          | t3dpcode (Expo push), MT Code           | planned, change 10 (ntfy instead)                            |
| Task board, inbox of what needs you                               | T3 Kanban, T3 Agents, Magnesium         | planned, change 11 (derived from thread state)               |
| Edit the latest message in place                                  | MT Code                                 | planned, change 12                                           |
| No product analytics by default                                   | E4 Code                                 | done, change 17                                              |
| Memory for agents                                                 | GOAT, seatedro, Scripted Alchemy, akeru | done, change 13 (modelled on GOAT)                           |
| Project and thread switchers in the breadcrumb                    | mollymillions-code branch               | planned, change 4                                            |
| Review surface: files, Reviewed marks, review guide               | E4 Code                                 | not planned                                                  |
| Start, stop and monitor local model servers from the thread panel | DeepQuantum                             | not planned yet                                              |
| Multi-thread split view (up to 4 panes)                           | Type-Delta, androforsov                 | not planned yet                                              |
| Prompt suggestion ghost text from the agent's own turn            | Type-Delta                              | not planned yet (touches projections)                        |
| Git graph panel                                                   | AVACode                                 | not planned yet                                              |
| Move a worktree thread into another checkout                      | EduardoDadalt                           | not planned yet                                              |
| Setting to omit the default branch prefix                         | 9cb14c1ec0                              | not planned yet (small)                                      |
| Sign-in through a forward-auth proxy (CORS preflight, timeouts)   | K-code (Cloudflare Access)              | not planned yet; relevant behind Authelia                    |
| Switch Claude or Codex accounts, usage bars with pace             | hafencity-dev, TemMax, Dylan-Grinboju   | not planned; only for several subscriptions                  |
| Local-model runaway-reply watchdog, "Local" instead of a price    | MiaAI-Lab                               | not planned yet                                              |
| Draft pull requests by default                                    | MT Code                                 | not planned yet                                              |
| Per-provider permission defaults                                  | MT Code                                 | not planned yet                                              |
| Advisor model for Claude                                          | MT Code                                 | not planned yet                                              |
| Fork a Claude or Codex conversation                               | t3dpcode                                | not planned yet                                              |
| Import conversations started outside T3                           | t3dpcode, K-code, aaditagrawal          | not planned yet (not checked against upstream)               |
| Disable Git checkpoints                                           | t3dpcode                                | not planned yet                                              |
| Agent hub grid, stop one subagent, full transcript mode           | K-code                                  | not planned yet (subagent stop may already exist upstream)   |
| Usage allowances, storage cleanup, execution inspector            | xiaoxin                                 | upstream has Usage and storage cleanup; the rest not planned |
| `.worktreeinclude`, SSH agent forwarding, multi-machine projects  | MT Code                                 | not planned yet                                              |
| Sidebar layouts, grouping by repository, project icons            | Jarne47                                 | upstream has grouping (beta); the rest not planned           |
| Computer Use, Computer View                                       | MT Code                                 | overlaps change 1 (Linux desktop in the Device panel)        |

## Forks that add features

### E4 Code, `stonith404/e4code`

Created 2026-10-30, pushed daily, MIT. The closest to this fork in shape: a thin stack of 8 patch commits rebased on
upstream, with its own `FORK_CHANGES.md` (each patch listed by commit subject). Builds from GitHub Releases, hourly
nightlies, macOS builds signed with a self-signed identity so the in-app updater works. Adds:

- **Review.** A right-panel surface for a thread's local changes, laid out like GitKraken: a file sidebar and one whole
  file at a time. Scopes Changes, Uncommitted and Unpushed. Per-file Reviewed and Check later marks, kept client-side;
  a reviewed file whose diff changes reads as Changed. A generated **review guide** (Markdown summary and files in
  reading order, reusing the pull-request review guide writer) and fixes typed straight into the diff. Web and desktop.
  One commit of 2,826 added lines in 51 files.
- **MCP servers in Settings.** One commit of 2,876 added lines in 33 files, for Claude and Codex.
  `packages/contracts/src/mcpServer.ts` (96 lines) defines the setting: stdio or Streamable HTTP, a list of provider
  instances per server, secrets (env, headers, client secret) in the secret store, reserved names `t3-code` and
  `t3-code-direct`. `McpServers.ts` (647) and `McpServersHttp.ts` (153) store the list, merge it across environments
  and do OAuth for HTTP servers (RFC 9728 and 8414 discovery, PKCE, refresh, and a proxy at `/mcp-servers/<name>` that
  adds the token). About 35 lines each in the Claude and Codex adapters add the servers beside `t3-code`. The Settings
  page is 938 lines plus a logic file. A write needs the providers-manage scope, since a stdio server runs on the host.
  Web only. It touches the files that conflict most on a rebase (both adapters, `ws.ts`, `rpc.ts`, `settings.ts`).
- **No product analytics by default** (`feat(telemetry): turn product analytics off by default`): the analytics flag
  defaults to off and the onboarding and About copy say so. 27 lines.
- **Clawdmeter.** Shows the environment's threads on an ESP32 desk display over Bluetooth, with no companion app. Not
  useful here.

Used for: change 16 (its contract and Settings logic are the base of the plan; the adapter hunks and OAuth are read
before copying), change 17 (same patch redone). Code was read for the contract and the commit's file list only.

### MT Code, `munimtechnologies/mtcode`

Created 2026-08-13, pushed daily, Apache-2.0. Desktop app for macOS, Windows and Linux (AppImage
and `.deb`), own app id and data directory, no hosted web app. It merges upstream only when asked and drops a row from
its comparison table when upstream ships the same, so its README table is a list of what upstream still lacks. Adds:

- **Computer Use and Computer View.** Agents click, type, screenshot and drive tabs in the user's installed browsers
  through an open-source helper; a live remote desktop of the machine a thread runs on, with the real cursor. Agents
  can list and start tasks on any machine the app already reaches (`computer_list`, `computer_send`). macOS-centric.
- **Realtime voice.** A call panel where the agent answers aloud, through a ChatGPT account or an OpenAI key.
- **Monitor toolkit.** `monitor_start` lets Codex end its turn and be woken by each line a background command prints.
- **Plugin marketplace.** Plugins, Apps, MCPs and Skills tabs across Codex, Claude Code and Cursor with one-click
  install; a cross-harness skills manager in Settings.
- **Edit your last message in place.** The thread rolls back and resends; upstream's _Edit from here_ returns the text
  to the composer.
- **Advisor model.** Claude consults a second model (fable, opus or sonnet) during a turn, set per Claude instance.
- **Multi-machine projects.** One-time copy of a project to another machine with uncommitted work, Git history and
  folders without Git; `.worktreeinclude`; SSH agent forwarding.
- **Self-hosted Android push** for thread updates, sent from the user's own server instead of T3's hosted relay.
- **Upstream tracking for forks.** The Pull Requests page shows upstream's latest release and its open pull requests
  ranked, with one click to take or port one into a worktree.
- Smaller: sign in extra Claude accounts from Settings; per-provider permission defaults; draft pull requests by
  default; `t3 .` opens a folder; recent-threads switcher (Ctrl+Tab, desktop); rename environments; Find in the
  terminal; Codex's own visualizations inline; OpenCode connected-subscription limits; Windows tray; an own theme.

Used for: change 12 (edit in place) and, as a pointer, change 10. Nothing else read beyond the README.

### T3 Kanban, `what1f/t3kanban`

MIT, alpha, 17 commits of its own on an old base (about 6,000 behind upstream), desktop builds for macOS (unsigned),
Windows and Linux. A thread and a task are the same thing: goal, status (Todo, In Progress, In Review, Blocked, Done),
agent run and review history in one place.

- A board and a list across all projects, drag between statuses. A create-task dialog: Markdown, images, project,
  status, agent and model, then start.
- An email-style **Inbox**: the latest result when an agent completes, fails, stops, asks or needs approval, with read
  state and deletion that persist, and one task never floods it.
- An MCP tool with which the active agent reads and updates its own task (title, description, status), so an edit made
  outside the conversation is not lost.
- Two modes: dispatch (leave it running, review when notified) and collaboration (the full conversation).

Used for: change 11 (the board and inbox, derived from thread state instead of a stored status). Only the README.

### T3 Agents, `jayleaton/t3code`

Pushed daily. Its README calls it "a UI wrapper", but its own commit subjects change the server too. A project task
board across connected environments (read-only), an Agents board with linked pull requests collapsed on cards, "managed
workers" (named child agents with a task each, failing closed when the task cannot be stored), schedules pinned to the
machine that hosts their project, check-backs for task owners, webhooks with idempotency, and a `t3 watch` command.
Its own `AGENTS.md` and release flow. Used for: a second look at change 11 (what a board across environments needs).
Only commit subjects read.

### t3dpcode, `ochen1/t3dpcode`

Created 2026-03-14, MIT. Fork-own commits: **self-hosted Android push**, fork a Claude or Codex conversation, import
external agent conversation history, allow disabling Git checkpoints, queued follow-ups kept on the server, a completion
sound preference, host XPC identity stripped from child processes.

The push commit (589 lines, read at the file list and the server file) is the closest prior art for change 10:
`SelfHostedPushNotifications.ts` (209 lines) keeps a `self_hosted_push_devices` table (`device_id`, Expo push token,
label) filled by two HTTP routes (register, unregister), follows orchestration events, reuses the relay's
`shouldPublishAgentAwarenessEvent` and `resolveAgentAwarenessRelayPublishSnapshot` (both exported from
`AgentAwarenessRelay.ts`), notifies only for approval, input, failure and completion, and posts to **Expo's push
service**. The app registers its token through a settings screen and a separate `google-services.self-hosted.json`.
So it still needs a Firebase project and Expo's hosted push service, which is why change 10 uses ntfy.

### MiaAI-Lab, `MiaAI-Lab/t3code`

"Local-first fork". Keeps a `MIA_CHANGELOG.md`. Cloud providers still work; local models are the default.

- **Use a local model** from first run: finds Ollama, LM Studio, llama.cpp, vLLM and SGLang servers on the machine, links
  an agent to one, makes it the default. **Settings → Inference** registers servers with readiness, models, context
  windows, load and a fallback server. Pi, OpenCode and Codex get a managed provider per server, with no
  `models.json` editing.
- **An inference gateway** that queues requests per server so parallel threads take turns, records tokens, queue wait,
  time to first token and decode speed (never text), and a **runaway-reply watchdog**: it stops a reply that repeats
  itself, reasons for about 128 KB without answering, or sends nothing for five minutes before its first token, and the
  thread says why with Continue and Choose model.
- **Never quietly cloud:** "Local models only" for background writing (titles, commit messages, PR text); local models
  are shown as **Local** and never priced; a model a server stopped serving is flagged before send.
- Image-reading check for local models, lean tool sets for Pi, cache-friendly compaction, and an `evals/mcp-tool-use`
  harness. SSH machines run the fork's own server, installed from the desktop app.

Useful for a local-model setup: the watchdog and the "Local" pricing rule. The queue duplicates what a model router in
front of the server already does. Only the README.

### K-code, `zt-hky/k-code`

An Oh My Pi (`omp`) first fork. **Agent Hub**: a live grid of every running agent and subagent with its current tool,
progress and latest thinking. Stop a single subagent without ending the turn. **Full transcript mode**: complete thinking
and tool input and output with no folds, for auditing. Resume sessions from an agent's own store, settings sync across
environments, an ocean-blue theme. Only the README.

### xiaoxin, `zds-xiaoxin/xiaoxin-t3code`

Chinese-language community build for macOS (Apple Silicon) and Windows, tracking upstream. A usage allowance panel with
always-shown items, task steps and progress in the sidebar, an artifact and image viewer that turns feedback into a
draft, a context panel with cache read and write and a handoff action, scoped disk cleanup with a previewed plan, a
read-only execution inspector, next-task presets, Spotlight indexing and search, two interface styles. Commit subjects
and README only.

### Scripted Alchemy, `ScriptedAlchemy/t3code`

Nightly fork that stays within a few commits of upstream (zero behind at the check, about +14k lines in 300+ files), with
an installer script and its own release channel including a **linux-x64 CLI tarball**. Fork-own commits show a **Loom**
view (agent lanes laid out like a Gantt chart), agent memory with a knowledge and project-memory pipeline (delivery
receipts, context budgets, source revalidation), an account pool, a "Labs" settings group and `pstack`. Large and
unreviewed. Commit subjects only.

### S2Code, `shuv1337/s2code`

Brand fork (devil-terminal identity), nightly only, own state directory and npm package. Adds an **Apple Watch** app, a
read-only **Apple TV** dashboard for paired servers, and two-way voice calls and dictation. Commit subjects and README.

### Magnesium, `iammrduncan/magnesium`

MIT, built on T3 Code 0.1.0, no releases. A self-hosted **hub** in front of one server per machine: pair a device once and
see every machine, project and thread. **Fleet** (machines live or offline with their running and waiting threads),
**Home** (approvals, questions, plans and failed runs from every machine, answered in place with Undo), profiles with
sandboxed or container agents (own rules, skills, MCP servers), machines in Kubernetes. Planned: push to a locked phone,
rooms with several bots, a knowledge base. Built for one person who drives many agents; the multi-machine parts do not
apply to a single host. README only.

### Campfire, `astraly-labs/campfire`

A deliberately thin fork (rebased regularly, `docs/UPSTREAM.md` states the policy) for small trusted teams: live
presence and typing state, durable side conversations attached to agent threads, mentions, unread state and a team inbox,
shared controls for long-running server-owned sessions. No RBAC or isolation by design. Not useful for one person.

### GOAT, `goat-si/goat`

MIT, active, 71 stars. Began as a T3 Code fork; its history was squashed on 2026-11-01 and it follows upstream by hand,
so its commits cannot be cherry-picked. It has the only provider-independent **memory** feature found: memories scoped
to all projects, one project or one thread; finished conversations summarized by a configurable model (plus a nightly
consolidation) and agents saving mid-thread through an MCP `memory.remember` tool; a briefing block injected from
`packages/provider-core` with a `memory.recall` tool, marked as untrusted reference data; small per-provider handling
for Codex (`CodexMemoryDelivery.ts`) and OpenCode (`memoryIsolation.ts`); import of Codex (`~/.codex/memories`), Claude
(`~/.claude/projects/*/memory`) and OMO memories; Settings → Memory on web, desktop and mobile. Storage is `memory_*`
tables in the server's own SQLite (migrations 088–093, about 20 tables for an event log, hub sync, conflict resolution
and quotas) with FTS5 (`unicode61`) search and no vectors: relevance plus recency, boosted by relation (this thread 1.0,
project 0.6, user 0.4). Recall relies on the agent retrying, which its briefing says to do two or three times. About 180
non-test memory files and 3.5 MB of source, so it cannot be taken piecemeal. Its `docs/user/memory.md` and
`docs/internals/memory-storage.md` are worth reading as a spec.

Used for: change 13, cut down to one table, term ranking and three MCP tools. Related: `opencoredev/akeru-bot` keeps
memory per bot as files with a review cadence (`apps/server/src/memory/BotMemory*.ts`), tied to its bot concept;
`seatedro/t3code` has an agent memory tool exposed through MCP plus a settings viewer (one commit, 1,990 added lines in
30 files); upstream's PR #1200 by 42tg (SQLite FTS5, 21k lines in 187 files) was closed unmerged on 2026-03-19.

### Single features from smaller forks

Commit sizes are added lines and files on the fork's own base.

| Feature                                                                                                                                          | Fork                      | Size                    | Notes                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| Start, stop and monitor **local model servers** from the thread details panel                                                                    | `DeepQuantum/t3code`      | +2555 / 26              | Closest to a local-model setup; upstream has no local-model support at all                          |
| **Multi-thread split view**, up to 4 panes                                                                                                       | `Type-Delta/t3code`       | +1346 / 16, +540 / 14   | Two commits; `androforsov/t3code` has a variant with per-pane selectors                             |
| **Prompt suggestion ghost text** from the agent's own turn                                                                                       | `Type-Delta/t3code`       | +1063 / 38              | Touches the projection pipeline, so a rebase risk                                                   |
| **Git graph panel**: commit browsing, branch switching by double click, uncommitted changes                                                      | `nodegan/AVACode`         | +2464 / 29              | Bundled with task-linked-branch code that would need untangling                                     |
| **Move a worktree thread** into the current checkout or another of the project's worktrees                                                       | `EduardoDadalt/t3code`    | about +1000 / 20, twice | Self-contained: a new `ThreadCheckoutService`                                                       |
| Setting to **omit the default branch prefix**                                                                                                    | `9cb14c1ec0/t3code`       | +328 / 14               | Small. The same fork has mobile text-to-speech readout (+313)                                       |
| **Cloudflare Access sign-in** for remote environments, with the CORS preflight and a 10-second timeout fix                                       | `zt-hky/k-code`           | +746 / 14, +53 / 2      | The preflight and timeout handling matters behind any forward-auth proxy                            |
| Account switcher for Claude Code and Codex in the sidebar                                                                                        | `hafencity-dev/t3code`    | about +12,500           | Too large to port; `TemMax` has another, `shwarmadev/hotlap` auto-switches by "sooner resets first" |
| Sidebar usage bars with pace                                                                                                                     | `Dylan-Grinboju`          | not sized               | Polish on upstream's usage limits                                                                   |
| Keyboard shortcuts for thread navigation, panel tabs, composer focus, confirming a thread deletion; a composer status line; side-chat navigation | `sorafujitani/t3code`     | +1.9k in 77 files       | Zero commits behind; hourly sync from its owner's machine; no releases                              |
| Right-to-left UI (Hebrew, Arabic, Persian), Claude and Codex usage bars, a turn-finished sound                                                   | `ttv20/t3code`            | +5.9k                   | Publishes a nightly linux-x64 server tarball                                                        |
| Projection-read performance fixes: avoid historical payload reads, seek selected runs                                                            | `ochen1/t3dpcode`         | not sized               | Worth cherry-picking if the database is large                                                       |
| MCP server OAuth flow with image annotation                                                                                                      | `machirajusaisandeep`     | not sized               | E4 Code's OAuth is the one to read first                                                            |
| Copy button on equations                                                                                                                         | `ErikGoranssonGaspar/ito` | not sized               | An applied-mathematics fork                                                                         |
| Swipe gestures on mobile                                                                                                                         | `42tg`                    | not sized               | Only useful with an own Android build                                                               |
| New providers: Command Code (about 15 commits, `Yousuf-Wizdan`), DeepSeek Harness, Agent Relay                                                   | several                   | not sized               | The ACP route may cover them                                                                        |

### Provider additions

- `jarmen423/t3code` (MIT): Hermes Agent, Devin and Muse Code as ACP providers, with model catalogs, slash commands and
  approval modes.
- `Peteralm/t3code` (MIT) and `yashptel/oh-my-t3code`: Oh My Pi (`omp`) with skills, commands, models, thinking, a
  context meter and session import.
- `aaditagrawal/t3code`: **unmaintained**; its README says upstream now ships what it added through ACP. Had Amp,
  Copilot, Gemini CLI, Droid, Kilo and Hermes adapters, Codex and Claude usage monitoring, importing sessions from the
  accounts' local files, and ran beside upstream (`t3f`, port 3873).
- `abhigyan-chatterjee/commandcode-t3`: Command Code as a provider; archived.
- `yappologistic/t3code` (CUT3, last pushed 2026-04-01): an early fork with Codex, Copilot, OpenCode, Kimi and Pi,
  slash commands, a skills picker, image limits, queue or steer for follow-ups and thread sharing.

### Other notable forks

- `Type-Delta/t3code`: made usable on Windows; 38 documented divergences, among them split view, prompt ghost text,
  API-gateway model catalogs and usage-limit auto-resume (+24.8k lines). Desktop installers only, and about 950 commits
  behind upstream, so its divergences would conflict heavily.
- `Jarne47/t3code`: sidebar layouts, sorting and pinned threads; grouping by repository or subfolder; project icons and
  thread status on folders; weekly upstream maintenance automation. Commit subjects only.
- `camie-ace/KamiCode`: auth profiles with same-provider switching, shared projects, a background-turn sound.
- `patroza/t3code`: a `fork/dev` branch of 10 commits that restore an older fork's pieces (providers, Git and source
  control behaviour, native browser preview authentication, bots, Jira and GitHub work-item automation, VS Code
  integration); the README is upstream's. Subjects only.
- `mollymillions-code/t3code` (MIT, no stars): its `feat/breadcrumb-switchers` branch is behind upstream discussion
  #31438 and is the source of change 4 (2 commits, web only, no contract or server change). Both breadcrumb crumbs
  become searchable dropdowns: the project crumb lists projects in sidebar order and opens the picked one's newest
  thread or a new one, with "New thread in <project>" first so today's click stays one step away; the thread crumb lists
  the project's threads (pinned first, older ones paged in while open), "New thread" first and "Thread actions" last;
  right-click and double-click on the title keep working.
- `UsefulSoftwareCo/openbot`: a browser app for project chats, agent threads, routines and computer control, with
  Executor as an optional MCP integration.
- `opencoredev/akeru-bot` (130 stars): an open Grok Bot alternative with named AI teammates, per-bot tools, instructions
  and memory.
- `filipgutica/t3code` (MIT): "T3 Code Workbench", with project planning and a Jira integration. Description only.
- `ehfreema/lct3`: build, sign and run an Xcode project on an iPhone from a thread. Description only.
- `optimus-brian/t8code`: description says issue tracking with OneDev and GitHub; no commits of its own (relevant to
  change 2, nothing to take).
- `eimexdev/t3code`: a rough gateway and interface for Hermes Agent.
- Description-only forks: `Luisgarcav/t3rl` (reinforcement-learning research), `ErikGoranssonGaspar/ito` (applied
  mathematics), `LAG-4/doer` (an app for non-developers), `epitaphwastakenn/Harp` (Roblox game development),
  `morrowbyte/t3code` ("Crew": conversations, research and delegated agents, with Android), `Cristian0101/nebula` (a
  multi-agent control plane), `KA3R0X/V3Copilot` (an Antigravity Agent Manager lookalike), `Apprenticed/t3code-localAI`
  (a local AI option), `Punit-Dethe/t3code-vanilla-gui` (no extra token overhead, native CLI behaviour),
  `xibn/t3neo` (quality-of-life changes, no commits of its own at the check).
- Chinese localizations with Windows or macOS installers: `ZhiweiXiao98/t3code`, `deepfry666/t3code-cn`,
  `Msurvil/t3code`.

## Using a fork as the base

Evaluated on 2026-11-09 and rejected: no fork fits better than upstream plus cherry-picks. Upstream makes about 70
commits a day, so "behind" only means something relative to that.

| Fork                                        | Ahead / behind  | Diff vs upstream  | Releases                       |
| ------------------------------------------- | --------------- | ----------------- | ------------------------------ |
| `stonith404/e4code`                         | 8 / 30          | +7.4k, 198 files  | nightly desktop, CLI archives  |
| `sorafujitani/t3code`                       | 78 / 0          | +1.9k, 77 files   | none                           |
| `ScriptedAlchemy/t3code`                    | 509 / 0         | +14k, 300+ files  | nightly, linux-x64 CLI tarball |
| `ttv20/t3code`                              | 90 / 103        | +5.9k, 300+ files | nightly, linux-x64 tarball     |
| `Type-Delta/t3code`                         | 165 / 948       | +24.8k            | desktop only                   |
| `MiaAI-Lab/t3code`                          | 131 / 153       | +15.6k, 263 files | none                           |
| `zt-hky/k-code`                             | 69 / 427        | +5.6k             | releases                       |
| `hafencity-dev`, `TemMax`, `Dylan-Grinboju` | 24–79 / 378–624 | +4k to +22k       | releases; all well behind      |

Reasons: a rebranded fork moves its state directory, app id and update URLs (E4 Code uses `~/.e4`, S2Code
`~/.s2code-v2`), which breaks deployments that assume upstream's names; only some forks publish a server build (a
linux-x64 CLI tarball: Scripted Alchemy and ttv20 do; E4 Code says it publishes CLI archives, not checked); a stale fork
(Type-Delta) conflicts on every rebase; and this fork's own commits would have to move onto someone else's history. The
features wanted are spread over several forks (local models in MiaAI-Lab and DeepQuantum, split view and ghost text in
Type-Delta, worktree move in EduardoDadalt, MCP settings in E4 Code), so one fork gives at most one or two. The route
is read-only remotes (`git remote add <name> <url>`) and cherry-picking single commits or small series. E4 Code is the
one to watch: it follows the same rules (small patches, a per-patch `FORK_CHANGES.md`, a rebase-based sync), and its repo
is the best template for documenting a fork.

## Rebrands and forks with nothing to take

`maria-rcks/t3libre` (one commit: "liberate T3 Code", a joke rebrand), `bdsqqq/t3code` and `thatmike1/t3code` (no
commits of their own at the check), `hlsitechio/t3code` (gone at the check; it was described as Codex-first with
browser integration, canvas previews and a GPU terminal), and forks with only an upstream README and no
commits of their own that could be told apart from upstream's (not all checked): `shadcn/t3code`,
`tannerlinsley/t3code`, `aidenybai/t3code` and similar.

## Refreshing this list

```sh
# The 400 most-starred forks, with description and last push
gh api 'repos/pingdotgg/t3code/forks?sort=stargazers&per_page=100' --paginate \
  --jq '.[] | [.full_name, .stargazers_count, .pushed_at, (.description // "")] | @tsv' | head -400

# What a fork added itself: its commits without an upstream PR number
gh api "repos/<owner>/<repo>/compare/pingdotgg:main...<default-branch>" \
  --jq '.commits[] | .commit.message | split("\n")[0]' | grep -vE '\(#[0-9]+\)$|^Merge'

# Size of one commit
gh api repos/<owner>/<repo>/commits/<sha> --jq '.stats, (.files[] | [.status,.additions,.deletions,.filename] | @tsv)'
```

Search for a name the list does not have with `gh search repos <name>`, and check the fork's own `FORK_CHANGES.md` or
`MIA_CHANGELOG.md`-style file first: forks that keep one describe their patches better than their commit log does.
