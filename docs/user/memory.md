# Memory

Memory keeps lasting preferences, decisions and facts so a new thread does not start from zero. It is shared by every
agent on the environment, whichever provider runs it: Claude, Codex, Cursor, OpenCode and the others. Open **Settings →
Memory** to see, search and change what is saved.

## What agents do with it

- Before a non-trivial task, an agent searches memory and uses what it finds.
- When you state a lasting preference, decision or fact, an agent can save it. Saving the same text again updates it
  instead of adding a copy.
- An agent can correct a memory or forget one.

Memory is background, not orders. Agents are told to treat it as reference data and to check anything that may have
changed. A short note about memory goes into each new session, but the memories themselves are sent to a model only when
an agent asks for them.

A new Claude session starts with your newest memories already in front of it (all-projects ones first, then the
thread's project's), the way Claude's own memory index would be. The rest are one search away. Other providers get the
search and save tools, but no starting list.

## Import Claude's memories

**Import…** under **Settings → Providers → Claude → Memory** copies what Claude Code saved on its own into this
memory. Enter the folder
that holds Claude's project folders (`~/.claude/projects` is the default, on the machine the environment runs on) and
**Scan**:

- Notes Claude kept about you or your preferences (`user`, `feedback`) import as **All projects**.
- Notes about one project (`project`, `reference`) need a project. The dialog picks it when the project's path matches
  Claude's folder name; otherwise choose one per folder.
- A note over 2000 characters is listed but cannot be imported: split it first. One you already saved is not added
  twice. Claude's files are never changed.

Claude Code keeps conversation transcripts in the same folder, so on a container copy only the `memory` folders there
rather than sharing the whole thing.

## Switches

Both apply to new sessions, not ones already running.

- **Agent memory** (on by default), at the top of **Settings → Memory**. Off: agents are not told about memory, and its
  tools answer that memory is turned off. Your saved memories stay, and you can still read, edit and forget them on the
  page.
- **Turn off Claude's built-in memory** (on by default, and only while agent memory is on), under **Settings →
  Providers → Claude → Memory**. New Claude sessions then run without Claude Code's own memory files, so there is one
  store instead of two. It is a setting of the environment, so every Claude instance there shows the same switch. Other
  providers' own memory is not affected.

## Scopes

- **All projects**: preferences that hold everywhere, such as "Reply in Polish".
- **One project**: facts about a single project, such as "Deploys go through Nomad". Agents in other projects never see
  it.

## Manage it in Settings

- **Add memory** saves one yourself. Pick the scope, and the project for a project memory.
- **Edit** changes the text. A memory you edited stays yours even if an agent later corrects it.
- **Forget** deletes a memory for good.
- Search matches every word you type. The scope menu narrows the list to all projects or one project.
- Each memory shows whether an agent or you saved it, and when it last changed.

You need permission to change settings on an environment to add, edit or forget; anyone who can read it can look.

## Limits

A memory is at most 2000 characters, and an environment holds at most 2000 memories. A full store refuses new memories
until you forget some; updating an existing one still works. Save one fact per memory: agents search by words, so short
and specific beats long.

Memory lives in the environment's own database. It is not shared between environments, and the mobile app does not have
a Memory page yet.

Do not save secrets. Anything saved is readable by every agent in the environment.
