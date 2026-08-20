# Plan 002: Settings viewer at /global/settings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- lib/claude/data.ts lib/claude/tree.ts app/global`
> Plan 001 may have landed (it doesn't touch these paths). If these paths changed in ways that
> contradict the "Current state" excerpts, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (001 recommended first, no hard dependency)
- **Category**: direction
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

The app is a read-only viewer for `~/.claude/` but shows nothing from `settings.json` — the file
that controls model, effort, hooks, permissions, and plugins. Surfacing it grouped and pretty-
printed lets the user audit their configuration (especially hooks and permission rules) without
opening a terminal. Read-only display; no editing.

## Current state

- Next.js 16 / Fumadocs app, **bun** package manager. No tests, no linter. Gate:
  `bun run types:check`.
- **The data file** `lib/claude/data.ts` starts:

  ```ts
  import fs from 'node:fs/promises';
  import os from 'node:os';
  import path from 'node:path';
  import matter from 'gray-matter';

  const CLAUDE_DIR = process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');
  const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
  ```

  Convention: every exported reader wraps filesystem access in try/catch and returns `null` or
  `[]` on failure — never throws. Exemplar (`lib/claude/data.ts:58-64`):

  ```ts
  /** The user's global instructions at ~/.claude/CLAUDE.md, or null if absent. */
  export async function getGlobalClaudeMd(): Promise<string | null> {
    try {
      return await fs.readFile(path.join(CLAUDE_DIR, 'CLAUDE.md'), 'utf8');
    } catch {
      return null;
    }
  }
  ```

- **The sidebar tree** `lib/claude/tree.ts`, `buildGlobalTree()` (lines 19-37):

  ```ts
  export async function buildGlobalTree(): Promise<Root> {
    const [claudeMd, groups] = await Promise.all([getGlobalClaudeMd(), listAllMemories()]);

    const children: Node[] = [{ type: 'page', name: 'Overview', url: '/global' }];
    if (claudeMd !== null) {
      children.push({ type: 'page', name: 'CLAUDE.md', url: '/global/claude-md' });
    }
    for (const g of groups) {
      ...
  ```

- **Page conventions** — exemplar `app/global/claude-md/page.tsx` (whole file):

  ```tsx
  import { notFound } from 'next/navigation';
  import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
  import { getGlobalClaudeMd } from '@/lib/claude/data';
  import { Markdown } from '@/components/markdown';

  export const dynamic = 'force-dynamic';

  export default async function Page() {
    const claudeMd = await getGlobalClaudeMd();
    if (claudeMd === null) notFound();

    return (
      <DocsPage>
        <DocsTitle>CLAUDE.md</DocsTitle>
        <DocsDescription className="mb-0 font-mono text-xs">~/.claude/CLAUDE.md</DocsDescription>
        <DocsBody>
          <Markdown text={claudeMd} />
        </DocsBody>
      </DocsPage>
    );
  }
  ```

  Match this: `force-dynamic` export, `DocsPage`/`DocsTitle`/`DocsDescription`/`DocsBody`,
  `notFound()` when data is absent, fumadocs `fd-*` color tokens for custom styling.

- **The real settings.json** (this machine, 2026-08-18) is a flat JSON object whose top-level
  keys are: `agentPushNotifEnabled, autoMode, editorMode, effortLevel, enabledPlugins,
  extraKnownMarketplaces, hooks, permissions, model, showClearContextOnPlanAccept, statusLine,
  tui, voice, voiceEnabled`. `hooks` is an object keyed by event name (currently `PreCompact`,
  `SessionStart`). Values are a mix of scalars, arrays, and nested objects. The set of keys is
  NOT stable across users/versions — unknown keys must render too.
- Repo warning from `AGENTS.md`: this Next.js version differs from training data; consult
  `node_modules/next/dist/docs/` if a Next API surprises you. The route pattern used here is
  copied verbatim from an existing working page, so no new Next APIs are involved.
- `next dev` regenerates a block in `AGENTS.md`; commit that file if it shows modified after
  running the dev server. The working tree has a pre-existing uncommitted `CLAUDE.md`
  modification — do not commit or revert it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run types:check`    | exit 0              |
| Dev server | `bun dev` (background)  | http://localhost:3000 |

## Scope

**In scope** (the only files you should modify/create):
- `lib/claude/data.ts` (add `getSettings`)
- `lib/claude/tree.ts` (add Settings sidebar entry)
- `app/global/settings/page.tsx` (create)
- `AGENTS.md` (only if regenerated by `next dev`)
- `plans/README.md` (status row)

**Out of scope**:
- Any write/edit capability for settings — viewer only.
- `~/.claude/settings.json.bak*` files — show only the live `settings.json`.
- `statusline.json` (separate file, future backlog).

## Git workflow

- Work on `main`. One commit, message style like `Settings viewer: grouped ~/.claude/settings.json`.
  Do NOT push.

## Steps

### Step 1: Add `getSettings()` to lib/claude/data.ts

Append after `getGlobalClaudeMd` (keep its style):

```ts
/** Parsed ~/.claude/settings.json, or null if absent or invalid. */
export async function getSettings(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(path.join(CLAUDE_DIR, 'settings.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 2: Create app/global/settings/page.tsx

Server component. Group known keys into sections; anything unrecognized lands in "Other" so the
page never silently drops data. Render every value as pretty-printed JSON in a `<pre>` (scalars
included — uniform and safe).

```tsx
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getSettings } from '@/lib/claude/data';

export const dynamic = 'force-dynamic';

const SECTIONS: [title: string, keys: string[]][] = [
  ['Model', ['model', 'effortLevel', 'autoMode']],
  ['Permissions', ['permissions']],
  ['Hooks', ['hooks']],
  ['Plugins', ['enabledPlugins', 'extraKnownMarketplaces']],
  [
    'Interface',
    [
      'editorMode',
      'tui',
      'statusLine',
      'voice',
      'voiceEnabled',
      'inputNeededNotifEnabled',
      'agentPushNotifEnabled',
      'showClearContextOnPlanAccept',
    ],
  ],
];

export default async function Page() {
  const settings = await getSettings();
  if (settings === null) notFound();

  const known = new Set(SECTIONS.flatMap(([, keys]) => keys));
  const other = Object.keys(settings).filter((k) => !known.has(k));
  const sections: [string, string[]][] = [...SECTIONS, ['Other', other]];

  return (
    <DocsPage>
      <DocsTitle>Settings</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">~/.claude/settings.json</DocsDescription>
      <DocsBody>
        {sections.map(([title, keys]) => {
          const present = keys.filter((k) => k in settings);
          if (present.length === 0) return null;
          return (
            <section key={title}>
              <h2>{title}</h2>
              {present.map((key) => (
                <div key={key} className="mb-4">
                  <div className="mb-1 font-mono text-xs text-fd-muted-foreground">{key}</div>
                  <pre className="overflow-x-auto rounded bg-fd-secondary p-2 text-xs">
                    {JSON.stringify(settings[key], null, 2)}
                  </pre>
                </div>
              ))}
            </section>
          );
        })}
      </DocsBody>
    </DocsPage>
  );
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 3: Add the sidebar entry

In `lib/claude/tree.ts`:

1. Extend the import from `./data`: add `getSettings`.
2. In `buildGlobalTree()`, extend the `Promise.all` to
   `const [claudeMd, settings, groups] = await Promise.all([getGlobalClaudeMd(), getSettings(), listAllMemories()]);`
3. Immediately **after** the `if (claudeMd !== null) { ... }` block, add:

   ```ts
   if (settings !== null) {
     children.push({ type: 'page', name: 'Settings', url: '/global/settings' });
   }
   ```

(Anchor matters: later plans insert History/Plans/Skills after this entry.)

**Verify**: `bun run types:check` → exit 0.

### Step 4: Verify in the dev server

Start `bun dev`, then:

```bash
curl -s http://localhost:3000/global/settings | grep -c 'settings.json'
curl -s http://localhost:3000/global/settings | grep -c 'PreCompact'
curl -s http://localhost:3000/global | grep -c '/global/settings'
```

**Verify**: all three counts ≥ 1 (the second confirms real hook data rendered; the third confirms
the sidebar link. If this machine's settings.json has no `hooks` key, substitute any key name you
saw in `jq -r 'keys[]' ~/.claude/settings.json`).

## Test plan

No test framework exists in this repo; the done criteria are the verification.

## Done criteria

- [ ] `bun run types:check` exits 0
- [ ] `curl -s http://localhost:3000/global/settings` returns HTTP 200 with at least one `<pre>` of settings JSON
- [ ] Sidebar on `/global` contains a Settings link (third `curl` in Step 4)
- [ ] With `CLAUDE_DIR=/nonexistent bun dev`, `/global/settings` returns 404 (notFound path works)
- [ ] `git status` clean outside in-scope files (pre-existing `CLAUDE.md` mod excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `buildGlobalTree()` no longer matches the "Current state" excerpt (a later plan's shape landed
  out of order).
- `settings.json` turns out to contain values that look like secrets (API keys, tokens). The page
  is localhost-only, but flag it so a human decides whether to mask specific keys. Do not invent
  a masking scheme yourself.
- Fumadocs components reject the JSX shape (e.g. `DocsBody` styling breaks `<pre>` badly enough
  to be unreadable) after one styling fix attempt.

## Maintenance notes

- New top-level settings keys automatically appear under "Other" — the SECTIONS map is a display
  nicety, not a schema. When Claude Code adds notable keys, promote them to a named section.
- Plans 003/004/005 insert further entries into `buildGlobalTree()` directly after this one;
  their anchors reference the `if (settings !== null)` block added here.
- Reviewer: check no editing affordances crept in, and that absent `settings.json` 404s rather
  than crashes.
