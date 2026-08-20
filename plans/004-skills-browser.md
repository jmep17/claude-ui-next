# Plan 004: Skills browser at /global/skills

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- lib/claude/data.ts lib/claude/tree.ts app/global`
> Plans 001–003 are expected to have landed (002 added `getSettings` + Settings entry, 003 added
> `listPlans`/`getPlan` + Plans entry). Any OTHER divergence from the "Current state" excerpts is
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (plugin directory layout is the least stable data source in this roadmap)
- **Depends on**: 003 (execute after it — both edit `buildGlobalTree()`)
- **Category**: direction
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

The user has 40 personal skills in `~/.claude/skills/` plus plugin-provided skills, and no way to
browse what each does without opening files in a terminal. A list page grouped by source and a
detail page rendering each `SKILL.md` makes the skill library inspectable — including trigger
descriptions, which are the part users forget.

## Current state — data on disk (verified 2026-08-18)

- **User skills**: `~/.claude/skills/<dir>/SKILL.md` — 40 directories, flat, no symlinks. Each
  `SKILL.md` has YAML frontmatter parseable with `gray-matter` (already a dependency), e.g.
  `~/.claude/skills/caveman/SKILL.md` starts:

  ```markdown
  ---
  name: caveman
  description: >
    Ultra-compressed communication mode. Cuts output tokens 65% (measured) ...
  ---
  ```

  Skill dirs may contain extra files/dirs beside SKILL.md (e.g. `references/`, `agents/`,
  `PHASE-BOUNDARIES.md`).
- **Plugin skills are NOT in `~/.claude/skills/`.** They are found via
  `~/.claude/plugins/installed_plugins.json`, format version 2:

  ```json
  {
    "version": 2,
    "plugins": {
      "mattpocock-skills@claude-plugins-official": [
        {
          "scope": "user",
          "installPath": "/Users/jorden/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3",
          "version": "1.2.3",
          ...
        }
      ]
    }
  }
  ```

  Skill files live at `<installPath>/skills/**/SKILL.md`, and the glob depth genuinely varies:
  both `<installPath>/skills/<skill>/SKILL.md` and
  `<installPath>/skills/<category>/<skill>/SKILL.md` exist (e.g.
  `.../mattpocock-skills/1.2.3/skills/productivity/handoff/SKILL.md`). The skill name is the
  **directory containing SKILL.md**.
- **Name collisions are real**: `tdd`, `code-review`, etc. exist both as user skills and in
  plugins. Therefore the route param must encode the source. Scheme (matches how Claude Code
  itself displays them, e.g. `mattpocock-skills:tdd`):
  - user skill id: `caveman`
  - plugin skill id: `<pluginName>:<skillDir>` where `pluginName` is the part before `@` in the
    installed_plugins key.

## Current state — code

- Next.js 16 / Fumadocs app, **bun**. No tests/linter. Gate: `bun run types:check`.
- `lib/claude/data.ts` header:

  ```ts
  const CLAUDE_DIR = process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');
  const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
  ```

  (After plan 003 there is also `PLANS_DIR`.) Conventions: try/catch → `null`/`[]`, never throw;
  validate path-forming params (see `getMemory`: rejects `/`, `\`); frontmatter parsing exemplar
  `listMemories` (`data.ts:179-204`) uses `matter(raw)` and defensive `typeof` checks on fields.
- `lib/claude/tree.ts` — after plan 003, `buildGlobalTree()` pushes, in order: Overview,
  CLAUDE.md (conditional), Settings (conditional), `Plans (N)` (conditional). The fumadocs page
  tree `Node` union supports folders (verified in
  `node_modules/fumadocs-core/dist/definitions-*.d.ts`):

  ```ts
  interface Folder {
    type: 'folder';
    name: ReactNode;
    defaultOpen?: boolean;
    index?: Item;      // Item = { type: 'page'; name; url }
    children: Node[];
  }
  ```

- Page conventions: `export const dynamic = 'force-dynamic'`; `params` is a Promise, awaited then
  `decodeURIComponent` (exemplar `app/p/[project]/memory/[file]/page.tsx`); fumadocs
  `DocsPage/DocsTitle/DocsDescription/DocsBody`; `fd-*` tokens; badge styling exemplar in that
  same file: `className="w-fit rounded-full border px-2 py-0.5 text-xs text-fd-muted-foreground"`.
- `AGENTS.md`: Next version differs from training data; copy the existing patterns, consult
  `node_modules/next/dist/docs/` only for anything novel. `next dev` may regenerate `AGENTS.md`
  (commit it if so). Pre-existing uncommitted `CLAUDE.md` change: leave alone.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run types:check`    | exit 0              |
| Dev server | `bun dev` (background)  | http://localhost:3000 |

## Scope

**In scope** (only these):
- `lib/claude/data.ts` (add `SkillEntry`, `Skill`, `listSkills`, `getSkill`)
- `lib/claude/tree.ts` (add Skills folder node)
- `app/global/skills/page.tsx` (create)
- `app/global/skills/[name]/page.tsx` (create)
- `AGENTS.md` (only if regenerated), `plans/README.md` (status row)

**Out of scope**:
- Rendering skills' reference files' contents on the detail page — list their names only.
  ("References expanded" from the draft roadmap is deferred; it needs per-file routes and
  traversal-safety design of its own.)
- A plugins viewer (installed/available/versions) — future backlog.
- `~/.claude/plugins/marketplaces/**` — marketplace checkouts include skills for plugins the
  user has NOT installed; only read paths listed in `installed_plugins.json`.

## Git workflow

- Work on `main`. One commit, e.g. `Skills browser: user and plugin SKILL.md viewer`. Do NOT push.

## Steps

### Step 1: Add data readers to lib/claude/data.ts

Add interfaces:

```ts
export interface SkillEntry {
  /** Route id: 'caveman' for user skills, 'plugin-name:skill' for plugin skills. */
  id: string;
  name: string;
  /** 'user' or the plugin name providing it. */
  source: string;
  description: string | null;
}

export interface Skill extends SkillEntry {
  content: string;
  /** Sibling files/dirs in the skill directory (excluding SKILL.md). */
  files: string[];
}
```

Add private helpers + readers (keep the file's error-swallowing style):

```ts
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');

function parseSkillFrontmatter(raw: string, fallbackName: string): { name: string; description: string | null } {
  const { data } = matter(raw);
  return {
    name: typeof data.name === 'string' ? data.name : fallbackName,
    description: typeof data.description === 'string' ? data.description.trim() : null,
  };
}

/** Directories under root (recursing at most `depth` levels) that contain a SKILL.md. */
async function findSkillDirs(root: string, depth: number): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) results.push(root);
  if (depth > 0) {
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.')) {
        results.push(...(await findSkillDirs(path.join(root, e.name), depth - 1)));
      }
    }
  }
  return results;
}

/** Installed plugins as [pluginName, installPath] pairs from installed_plugins.json (v2). */
async function installedPlugins(): Promise<[string, string][]> {
  let raw;
  try {
    raw = await fs.readFile(path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'), 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const plugins = parsed?.plugins;
    if (typeof plugins !== 'object' || plugins === null) return [];
    const pairs: [string, string][] = [];
    for (const [key, installs] of Object.entries(plugins)) {
      const installPath = Array.isArray(installs) ? installs[0]?.installPath : undefined;
      if (typeof installPath === 'string') pairs.push([key.split('@')[0], installPath]);
    }
    return pairs;
  } catch {
    return [];
  }
}

/** User skills from ~/.claude/skills plus skills of installed plugins. */
export async function listSkills(): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  const userDirs = await findSkillDirs(SKILLS_DIR, 1);
  for (const dir of userDirs) {
    if (dir === SKILLS_DIR) continue;
    try {
      const raw = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
      const base = path.basename(dir);
      const fm = parseSkillFrontmatter(raw, base);
      skills.push({ id: base, name: fm.name, source: 'user', description: fm.description });
    } catch {
      // unreadable skill — skip
    }
  }

  for (const [plugin, installPath] of await installedPlugins()) {
    const dirs = await findSkillDirs(path.join(installPath, 'skills'), 2);
    for (const dir of dirs) {
      try {
        const raw = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
        const base = path.basename(dir);
        const fm = parseSkillFrontmatter(raw, base);
        skills.push({ id: `${plugin}:${base}`, name: fm.name, source: plugin, description: fm.description });
      } catch {
        // skip
      }
    }
  }

  return skills.sort((a, b) => Number(a.source !== 'user') - Number(b.source !== 'user') || a.id.localeCompare(b.id));
}

export async function getSkill(id: string): Promise<Skill | null> {
  if (!/^[A-Za-z0-9_-]+(:[A-Za-z0-9_-]+)?$/.test(id)) return null;
  const [first, second] = id.split(':');

  let dir: string | null = null;
  if (second === undefined) {
    dir = path.join(SKILLS_DIR, first);
  } else {
    const plugin = (await installedPlugins()).find(([name]) => name === first);
    if (plugin) {
      const dirs = await findSkillDirs(path.join(plugin[1], 'skills'), 2);
      dir = dirs.find((d) => path.basename(d) === second) ?? null;
    }
  }
  if (dir === null) return null;

  let raw, entries;
  try {
    [raw, entries] = await Promise.all([
      fs.readFile(path.join(dir, 'SKILL.md'), 'utf8'),
      fs.readdir(dir),
    ]);
  } catch {
    return null;
  }
  const fm = parseSkillFrontmatter(raw, path.basename(dir));
  const { content } = matter(raw);
  return {
    id,
    name: fm.name,
    source: second === undefined ? 'user' : first,
    description: fm.description,
    content,
    files: entries.filter((f) => f !== 'SKILL.md').sort(),
  };
}
```

Note the regex guard is the traversal defense: ids can't contain `/`, `\`, or `.`.

**Verify**: `bun run types:check` → exit 0.

### Step 2: Create the list page `app/global/skills/page.tsx`

Group by `source` ('user' first, then each plugin), one section per source, entries linking to
`/global/skills/${encodeURIComponent(s.id)}` with the description in
`text-fd-muted-foreground` — structurally identical to the memory listing in
`app/global/page.tsx` (sections → `<ul>` → `<li>` with Link + muted description). Use
`DocsTitle` "Skills" and `DocsDescription` `~/.claude/skills + installed plugins`.

**Verify**: `bun run types:check` → exit 0.

### Step 3: Create the detail page `app/global/skills/[name]/page.tsx`

Follow `app/p/[project]/memory/[file]/page.tsx` exactly (Promise params, decodeURIComponent,
notFound, badge span):

- `DocsTitle`: skill name. `DocsDescription`: the description, if any.
- A badge span with the source (`user` or plugin name), using the memory page's badge classes.
- `DocsBody` → `<Markdown text={skill.content} />`.
- If `skill.files.length > 0`, after the body add a "Files" heading and a `<ul>` of file names
  (plain text, no links — content viewing is out of scope).

**Verify**: `bun run types:check` → exit 0.

### Step 4: Sidebar folder

In `lib/claude/tree.ts`: import `listSkills`, add it to the `Promise.all` in `buildGlobalTree()`
(after `listPlans()`), and insert **directly after** the `if (plans.length > 0) { ... }` block:

```ts
const userSkills = skills.filter((s) => s.source === 'user');
if (skills.length > 0) {
  children.push({
    type: 'folder',
    name: `Skills (${skills.length})`,
    defaultOpen: false,
    index: { type: 'page', name: 'All Skills', url: '/global/skills' },
    children: userSkills.map((s) => ({
      type: 'page',
      name: s.name,
      url: `/global/skills/${encodeURIComponent(s.id)}`,
    })),
  });
}
```

Design decision (intentional): the folder's children are **user skills only** — plugin skills
(~20 more, with colliding names) would bloat the sidebar; they're reachable from the All Skills
index page. Do not add them as children.

**Verify**: `bun run types:check` → exit 0.

### Step 5: Verify in the dev server

Start `bun dev`, then:

```bash
curl -s http://localhost:3000/global/skills | grep -c '/global/skills/caveman'
curl -s http://localhost:3000/global/skills/caveman | grep -c 'Ultra-compressed'
curl -s "http://localhost:3000/global/skills/mattpocock-skills%3Atdd" -o /dev/null -w '%{http_code}\n'
curl -s "http://localhost:3000/global/skills/..%2Fsettings" -o /dev/null -w '%{http_code}\n'
```

**Verify**: counts ≥ 1; third prints `200` (plugin skill resolves); fourth prints `404`.
(If `mattpocock-skills` is no longer installed on this machine, substitute any
`<plugin>:<skill>` id shown on `/global/skills`.)

## Test plan

No test framework in this repo; done criteria are the verification.

## Done criteria

- [ ] `bun run types:check` exits 0
- [ ] `/global/skills` shows a `user` section with ≥ 1 skill and ≥ 1 plugin section
- [ ] User skill detail and plugin skill detail pages both return 200 with rendered markdown
- [ ] Traversal probe (Step 5) returns 404
- [ ] Sidebar shows a collapsed `Skills (N)` folder whose index links to `/global/skills`
- [ ] `git status` clean outside in-scope files (pre-existing `CLAUDE.md` mod excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `installed_plugins.json` has a `version` other than 2 or a different `plugins` shape than the
  excerpt — the format is Claude Code-internal and may have migrated.
- Two installed plugins share the same pre-`@` name (id scheme would collide) — report; a human
  chooses a disambiguation scheme.
- `buildGlobalTree()` doesn't contain the plan-003 `Plans (N)` block (anchor missing).
- Skill frontmatter fails to parse with gray-matter on >2 files (would suggest a frontmatter
  dialect assumption is wrong).

## Maintenance notes

- The plugin-skill discovery reads only `installPath`s from `installed_plugins.json`; when Claude
  Code changes its plugin cache layout, `findSkillDirs`' depth-2 walk is the first thing to
  break. The failure mode is an empty plugin section, not a crash.
- The future "plugins viewer" backlog item should reuse `installedPlugins()` — keep it private
  but factor-ready.
- Reviewer: check the id regex guard, the marketplaces-dir exclusion (only installed plugins are
  read), and that sidebar children are user skills only per the design decision above.
