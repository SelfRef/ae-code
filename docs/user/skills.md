# Skills

A skill is a folder with a `SKILL.md` that teaches an agent how to do one kind of task. Every provider has its own skills
folder, so a skill made for one is often missing for another. **Settings → Skills** keeps one library on the environment
and makes it available to the providers that can use it. Skills stay ordinary open-format folders: providers load them
themselves, so the `/` and `$` skill menus in the composer keep working.

## The library

The library is `~/.agents/skills` on the machine the environment runs on, one folder per skill. Each environment has
its own; nothing is synced between them.

- **Codex, Cursor, OpenCode, Pi and fx** read that folder themselves, so a skill in the library is theirs already (green
  badge).
- **Claude, Antigravity, Grok and Kiro** read a folder of their own. Their switch under a skill adds or removes a
  relative link from that folder to the library, so the files stay in one place. Claude's folder follows the instance's
  home setting. A link is only removed when it provably points at that skill; a real folder or a different skill with
  the same name is never replaced (the badge says _name taken_).
- Providers with no skills folder of their own (the generic ACP ones, Muse) are not listed.

New skills and links reach sessions that start afterwards, not ones already running.

## Make or change a skill

**New skill** asks for a name (lowercase letters, digits and single hyphens, up to 64) and a one-line description, then
opens the generated `SKILL.md` for you to fill in. The pencil edits the `SKILL.md` of an existing skill; other files in
the folder are listed but not edited here. A skill that is a link to a folder elsewhere is read-only: edit it where it
lives.

A folder without a usable `SKILL.md` (missing, no frontmatter, no description) is listed with a warning.

## Install from a repository

**Install** takes `owner/repo` (GitHub), `owner/repo@skill` for one skill, or an https or ssh git URL, plus an optional
branch or tag. **Find skills** fetches the repository (shallow, to a throwaway folder) and lists every folder that has a
`SKILL.md`; tick the ones you want. A skill already in the library is left alone unless you choose to replace it, in
which case the old one goes to the trash. Links keep working across a replace.

Skills are instructions your agents follow and may ship scripts they run, so install only from sources you trust. Only
files are copied: links in a repository are not followed, and a skill over 2000 files or 20 MB is refused. Local paths and
`file:` URLs are refused.

A skill remembers where it came from (`~/.agents/.ae-skills.json`). The refresh button on it fetches the source again
and replaces the skill when the repository has a newer commit.

## Remove and restore

Removing a skill moves it to a trash (`~/.agents/.skills-trash`) and takes its links away. **Recently removed** keeps it
for 14 days: **Restore** puts it back and restores the links it had.

## Skills the library does not manage

The last section lists what providers load from their own folders: plugin, built-in and synced skills, and folders made
by hand. They belong to the provider, so they are listed but never moved or changed.

## What agents can do

Agents on every provider reach the library through five T3 tools, so "make me a skill for this" works the same on
Claude, Codex, Cursor and the rest:

- `t3_skill_list` and `t3_skill_read` show the library, what each provider can use, and a skill's `SKILL.md`. Any thread
  may call them.
- `t3_skill_write` (create or rewrite a `SKILL.md`), `t3_skill_link` and `t3_skill_remove` change it. They work only in
  a thread running in **full access**, where the agent can already write any file without asking; in any other mode
  they refuse and say so, and you change skills in Settings. Removing goes to the trash like the page's button, so you
  can restore it.
- Installing from a repository and updating stay in Settings: an agent cannot fetch instructions from a remote on its
  own.

A skill an agent writes reaches sessions that start afterwards, like any other change, and shows in the page at once.
Skills are instructions every later session follows, so read what an agent wrote before you rely on it.

## Permissions

Listing and reading need the same access as reading threads. Making, editing, linking, removing and installing need file
write access (`filesystem:write`), because the library holds instructions that agents run and links reach into other
providers' folders. Installing also runs `git` against the remote you name.
