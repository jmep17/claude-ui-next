# Plan 003: Plans browser at /global/plans

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- lib/claude/data.ts lib/claude/tree.ts app/global`
> Plans 001–002 are expected to have landed (002 adds `getSettings` and a Settings sidebar
> entry). Any OTHER divergence from the "Current state" excerpts is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 002 (execute after it — both edit `buildGlobalTree()`)
- **Category**: direction
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

`~/.claude/plans/` holds every plan Claude Code has written for this user (53 markdown files,
~700 KB on this machine, growing). They're currently only readable in a terminal. A list page
plus a markdown detail view makes past plans browsable and searchable-by-eye, and (after plan
001) code blocks inside them render highlighted.

## Current state

- Next.js 16 / Fumadocs app, **bun**. No tests/linter. Gate: `bun run types:check`.
- `~/.claude/plans/` contains flat `*.md` files, e.g. `adaptive-cuddling-raccoon.md`. Most start
  with a `# Title` heading, but NOT all are guaranteed to — fall back to the filename.
- `lib/claude/data.ts` header (unchanged by plan 002):

  ```ts
  const CLAUDE_DIR = process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');
  const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
  ```

  Conventions in this file you must match:
  - try/catch returning `null`/`[]`, never throw (see `getGlobalClaudeMd`, `listMemories`).
  - Filename params validated before joining paths — exemplar `getMemory`
    (`lib/claude/data.ts:206-207` at planning time):

    ```ts
    export async function getMemory(slug: string, file: string): Promise<Memory | null> {
      if (file.includes('/') || file.includes('\\') || !file.endsWith('.md')) return null;
    ```

- `lib/claude/tree.ts` — after plan 002, `buildGlobalTree()` contains:

  ```ts
  if (claudeMd !== null) {
    children.push({ type: 'page', name: 'CLAUDE.md', url: '/global/claude-md' });
  }
  if (settings !== null) {
    children.push({ type: 'page', name: 'Settings', url: '/global/settings' });
  }
  ```

- Dynamic-route page convention — exemplar `app/p/[project]/memory/[file]/page.tsx`: `params` is
  a **Promise** and must be awaited; the file param goes through `decodeURIComponent`:

  ```tsx
  export const dynamic = 'force-dynamic';

  export default async function Page({
    params,
  }: {
    params: Promise<{ project: string; file: string }>;
  }) {
    const { project, file } = await params;
    const memory = await getMemory(project, decodeURIComponent(file));
    if (!memory) notFound();
  ```

- List-page convention — exemplar `app/global/page.tsx`: server component, `force-dynamic`,
  `DocsPage`/`DocsTitle`/`DocsDescription`/`DocsBody`, `next/link`, muted text via
  `text-fd-muted-foreground`.
- Date formatting convention — `lib/claude/tree.ts:6-8` uses explicit locale to keep server
  rendering deterministic:

  ```ts
  function shortDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  ```

- `AGENTS.md` warns this Next.js version differs from training data — the patterns above are
  copied from working pages, so stick to them; consult `node_modules/next/dist/docs/` only if
  something new is needed. `next dev` may regenerate `AGENTS.md`; commit it if modified. A
  pre-existing uncommitted `CLAUDE.md` change exists — leave it alone.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run types:check`    | exit 0              |
| Dev server | `bun dev` (background)  | http://localhost:3000 |

## Scope

**In scope** (only these):
- `lib/claude/data.ts` (add `PlanEntry`, `Plan`, `listPlans`, `getPlan`)
- `lib/claude/tree.ts` (add `Plans (N)` sidebar entry)
- `app/global/plans/page.tsx` (create)
- `app/global/plans/[file]/page.tsx` (create)
- `AGENTS.md` (only if regenerated), `plans/README.md` (status row)

**Out of scope**:
- The repo's own `plans/` directory (these files) — the browser reads `~/.claude/plans/`, not
  the repo. Do not conflate them.
- Search/filtering UI — list is short enough; future work.
- Editing or deleting plan files.

## Git workflow

- Work on `main`. One commit, e.g. `Plans browser: list and view ~/.claude/plans`. Do NOT push.

## Steps

### Step 1: Add data readers

In `lib/claude/data.ts`, add near the other interfaces:

```ts
export interface PlanEntry {
  file: string;
  title: string;
  mtime: Date;
  size: number;
}

export interface Plan extends PlanEntry {
  content: string;
}
```

Add `const PLANS_DIR = path.join(CLAUDE_DIR, 'plans');` next to `PROJECTS_DIR`. Then add:

```ts
/** All markdown plans in ~/.claude/plans, newest first. */
export async function listPlans(): Promise<PlanEntry[]> {
  let files;
  try {
    files = await fs.readdir(PLANS_DIR);
  } catch {
    return [];
  }
  const plans = await Promise.all(
    files
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map(async (file) => {
        const full = path.join(PLANS_DIR, file);
        const [stat, raw] = await Promise.all([fs.stat(full), fs.readFile(full, 'utf8')]);
        const heading = raw.match(/^#\s+(.+)$/m);
        return {
          file,
          title: heading ? heading[1].trim() : file.replace(/\.md$/, ''),
          mtime: stat.mtime,
          size: stat.size,
        };
      }),
  );
  return plans.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export async function getPlan(file: string): Promise<Plan | null> {
  if (file.includes('/') || file.includes('\\') || file.startsWith('.') || !file.endsWith('.md')) return null;
  let raw, stat;
  try {
    const full = path.join(PLANS_DIR, file);
    [raw, stat] = await Promise.all([fs.readFile(full, 'utf8'), fs.stat(full)]);
  } catch {
    return null;
  }
  const heading = raw.match(/^#\s+(.+)$/m);
  return {
    file,
    title: heading ? heading[1].trim() : file.replace(/\.md$/, ''),
    mtime: stat.mtime,
    size: stat.size,
    content: raw,
  };
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 2: Create the list page `app/global/plans/page.tsx`

```tsx
import Link from 'next/link';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { listPlans } from '@/lib/claude/data';

export const dynamic = 'force-dynamic';

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function shortSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function Page() {
  const plans = await listPlans();

  return (
    <DocsPage>
      <DocsTitle>Plans</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">~/.claude/plans · {plans.length} files</DocsDescription>
      <DocsBody>
        {plans.length === 0 && <p>No plans found.</p>}
        <ul>
          {plans.map((p) => (
            <li key={p.file}>
              <Link href={`/global/plans/${encodeURIComponent(p.file)}`}>{p.title}</Link>{' '}
              <span className="text-fd-muted-foreground">
                — {shortDate(p.mtime)} · {shortSize(p.size)}
              </span>
            </li>
          ))}
        </ul>
      </DocsBody>
    </DocsPage>
  );
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 3: Create the detail page `app/global/plans/[file]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getPlan } from '@/lib/claude/data';
import { Markdown } from '@/components/markdown';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const plan = await getPlan(decodeURIComponent(file));
  if (!plan) notFound();

  return (
    <DocsPage>
      <DocsTitle>{plan.title}</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">~/.claude/plans/{plan.file}</DocsDescription>
      <DocsBody>
        <Markdown text={plan.content} />
      </DocsBody>
    </DocsPage>
  );
}
```

Note: plan markdown usually re-states its own `# Title` as the first line, so the page shows the
title twice (DocsTitle + body h1). Acceptable; do not strip content.

**Verify**: `bun run types:check` → exit 0.

### Step 4: Sidebar entry

In `lib/claude/tree.ts`: import `listPlans` from `./data`, extend the `Promise.all` in
`buildGlobalTree()` to also fetch `plans` (`const [claudeMd, settings, plans, groups] = await
Promise.all([getGlobalClaudeMd(), getSettings(), listPlans(), listAllMemories()]);`), and
insert **directly after** the `if (settings !== null) { ... }` block:

```ts
if (plans.length > 0) {
  children.push({ type: 'page', name: `Plans (${plans.length})`, url: '/global/plans' });
}
```

(Plan 005 will later insert a History entry between Settings and this block; do not leave
anchoring comments, the order in code is the anchor.)

**Verify**: `bun run types:check` → exit 0.

### Step 5: Verify in the dev server

Start `bun dev`, then:

```bash
curl -s http://localhost:3000/global/plans | grep -c '/global/plans/'
first=$(ls ~/.claude/plans/*.md | head -1 | xargs basename)
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/global/plans/$first"
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/global/plans/..%2F..%2Fsettings.json"
```

**Verify**: first count ≥ 1; second prints `200`; third prints `404` (traversal rejected).

## Test plan

No test framework in this repo; done criteria are the verification.

## Done criteria

- [ ] `bun run types:check` exits 0
- [ ] `/global/plans` lists ≥ 1 plan with date and size
- [ ] A real plan detail page returns 200 and renders markdown (contains `<h2` or `<p`)
- [ ] Traversal probe from Step 5 returns 404
- [ ] Sidebar shows `Plans (N)`: `curl -s http://localhost:3000/global | grep -c '/global/plans'` ≥ 1
- [ ] `git status` clean outside in-scope files (pre-existing `CLAUDE.md` mod excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `buildGlobalTree()` doesn't contain the plan-002 shape shown in "Current state" (002 not
  landed, or drifted) — this plan's Step 4 anchor would be wrong.
- `~/.claude/plans/` contains subdirectories or non-md files that the listing mishandles beyond
  the filters above.
- The list page takes noticeably long (>2s) to respond — reading every file for its title may
  need a head-only read like `readFirstPrompt` in data.ts; report rather than redesign.

## Maintenance notes

- `listPlans` reads every plan file fully to extract the title. Fine at ~700 KB total; if the
  plans dir grows into tens of MB, switch to a bounded head read (see `readFirstPrompt` in
  `lib/claude/data.ts` for the pattern).
- Future backlog item "full-text search" would index these files; keep `listPlans`' return shape
  stable.
- Reviewer: check the traversal guard in `getPlan` and that the repo-local `plans/` directory
  was not accidentally read instead of `~/.claude/plans`.
