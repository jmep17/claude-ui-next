# Plan 005: Prompt history at /global/history

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- lib/claude/data.ts lib/claude/tree.ts app/global components`
> Plans 001–004 are expected to have landed (tree.ts now has Settings, Plans, Skills entries).
> Any OTHER divergence from the "Current state" excerpts is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 004 (execute after it — both edit `buildGlobalTree()`)
- **Category**: direction
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

`~/.claude/history.jsonl` records every prompt the user has typed across all projects (633 lines
on this machine). Today "what did I ask Claude last Tuesday, and in which project?" requires
grepping JSONL. A searchable, project-filterable timeline that deep-links into the existing
session transcript viewer turns that file into the app's cross-project entry point.

## Current state — data on disk (verified 2026-08-18)

- `~/.claude/history.jsonl`: one JSON object per line, keys exactly
  `display, pastedContents, project, sessionId, timestamp`.
  - `display`: the prompt text (string).
  - `timestamp`: **epoch milliseconds** (number), e.g. `1785326936330`. NOT an ISO string
    (transcript files use ISO strings — don't confuse the two).
  - `project`: absolute path, e.g. `/Users/jorden/src/focus-tool`.
  - `sessionId`: UUID matching a `~/.claude/projects/<slug>/<sessionId>.jsonl` transcript.
  - `pastedContents`: object; ignore it in this plan.
- Slug encoding: project path → directory name under `~/.claude/projects/` by replacing every
  non-alphanumeric character with `-`. Verified examples: `/Users/jorden/src/claude-ui-next` →
  `-Users-jorden-src-claude-ui-next`, and `/Users/jorden/.claude` → `-Users-jorden--claude`
  (the `.` also becomes `-`). Some history entries reference projects whose directory no longer
  exists, and some sessions are deleted — links must only be emitted when the target transcript
  file actually exists.

## Current state — code

- Next.js 16 / Fumadocs app, **bun**. No tests/linter. Gate: `bun run types:check`.
- `lib/claude/data.ts` header:

  ```ts
  const CLAUDE_DIR = process.env.CLAUDE_DIR ?? path.join(os.homedir(), '.claude');
  const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
  ```

  Conventions: try/catch → `null`/`[]`, never throw; line-by-line JSONL parsing with per-line
  try/catch exemplar in `readTranscript` (`data.ts:279+`).
- Session transcript route (link target) exists: `/p/<slug>/session/<sessionId>` served by
  `app/p/[project]/session/[id]/page.tsx`; it 404s via `notFound()` if the transcript is missing.
- `lib/claude/tree.ts` — after plan 004, `buildGlobalTree()` pushes in order: Overview, CLAUDE.md
  (cond.), Settings (cond.), `Plans (N)` (cond.), Skills folder (cond.), then memory separators.
- **There is no client component in the repo yet** — everything is server components. This plan
  adds the first one; full code is inlined below (nothing to pattern-match against). Client
  components need `'use client'` as the first line.
- Server/client boundary rule from the draft roadmap, adopted here: pass timestamps across the
  boundary as **numbers** (epoch ms) and format them in the component.
- Page conventions: `force-dynamic`, `DocsPage/DocsTitle/DocsDescription/DocsBody`, `fd-*`
  tokens (`bg-fd-secondary`, `text-fd-muted-foreground`, `bg-fd-card`, `border`).
- `AGENTS.md`: this Next.js version differs from training data — if unsure about client
  components/serialization, read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
  `next dev` may regenerate `AGENTS.md` (commit if so). Pre-existing uncommitted `CLAUDE.md`
  change: leave alone.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run types:check`    | exit 0              |
| Dev server | `bun dev` (background)  | http://localhost:3000 |

## Scope

**In scope** (only these):
- `lib/claude/data.ts` (add `HistoryEntry`, `getHistory`)
- `lib/claude/tree.ts` (add History sidebar entry)
- `app/global/history/page.tsx` (create)
- `components/history-timeline.tsx` (create)
- `AGENTS.md` (only if regenerated), `plans/README.md` (status row)

**Out of scope**:
- Rendering `pastedContents`.
- Pagination/virtualization — 633 rows renders fine; revisit at ~10k (note left in code is fine).
- Usage analytics/charts (future backlog).

## Git workflow

- Work on `main`. One commit, e.g. `Prompt history: searchable timeline from history.jsonl`.
  Do NOT push.

## Steps

### Step 1: Add `getHistory()` to lib/claude/data.ts

```ts
export interface HistoryEntry {
  display: string;
  /** Absolute project path as recorded by Claude Code. */
  project: string;
  /** Matching directory under ~/.claude/projects, or null if it no longer exists. */
  slug: string | null;
  sessionId: string | null;
  /** True only when the session transcript file exists (safe to link). */
  hasSession: boolean;
  /** Epoch milliseconds. */
  timestamp: number;
}

/** All prompts from ~/.claude/history.jsonl, newest first. */
export async function getHistory(): Promise<HistoryEntry[]> {
  let raw;
  try {
    raw = await fs.readFile(path.join(CLAUDE_DIR, 'history.jsonl'), 'utf8');
  } catch {
    return [];
  }
  let projectDirs: Set<string>;
  try {
    projectDirs = new Set(await fs.readdir(PROJECTS_DIR));
  } catch {
    projectDirs = new Set();
  }

  // One readdir per referenced project, cached — not one stat per history line.
  const sessionCache = new Map<string, Set<string>>();
  async function sessionIds(slug: string): Promise<Set<string>> {
    let ids = sessionCache.get(slug);
    if (!ids) {
      try {
        const files = await fs.readdir(path.join(PROJECTS_DIR, slug));
        ids = new Set(files.filter((f) => f.endsWith('.jsonl')).map((f) => f.replace(/\.jsonl$/, '')));
      } catch {
        ids = new Set();
      }
      sessionCache.set(slug, ids);
    }
    return ids;
  }

  const entries: HistoryEntry[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed?.display !== 'string' || typeof parsed?.timestamp !== 'number') continue;
    const project = typeof parsed.project === 'string' ? parsed.project : '';
    const candidate = project.replace(/[^a-zA-Z0-9]/g, '-');
    const slug = projectDirs.has(candidate) ? candidate : null;
    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
    const hasSession = slug !== null && sessionId !== null && (await sessionIds(slug)).has(sessionId);
    entries.push({ display: parsed.display, project, slug, sessionId, hasSession, timestamp: parsed.timestamp });
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 2: Create `components/history-timeline.tsx` (client component)

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { HistoryEntry } from '@/lib/claude/data';

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function projectName(project: string): string {
  return project.split('/').pop() || project;
}

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');

  const projects = useMemo(
    () => [...new Set(entries.map((e) => e.project).filter(Boolean))].sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return entries.filter(
      (e) => (project === '' || e.project === project) && (q === '' || e.display.toLowerCase().includes(q)),
    );
  }, [entries, query, project]);

  const groups = useMemo(() => {
    const byDay = new Map<string, HistoryEntry[]>();
    for (const e of filtered) {
      const day = dayLabel(e.timestamp);
      const list = byDay.get(day);
      if (list) list.push(e);
      else byDay.set(day, [e]);
    }
    return [...byDay.entries()];
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts…"
          className="w-64 rounded border bg-fd-secondary px-3 py-1.5 text-sm"
        />
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="rounded border bg-fd-secondary px-2 py-1.5 text-sm"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {projectName(p)}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-fd-muted-foreground">
          {filtered.length} of {entries.length}
        </span>
      </div>

      {groups.map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-2 text-sm font-medium text-fd-muted-foreground">{day}</h3>
          <ul className="flex flex-col gap-1">
            {items.map((e, i) => {
              const body = (
                <>
                  <span className="shrink-0 font-mono text-xs text-fd-muted-foreground">{timeLabel(e.timestamp)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.display}</span>
                  <span className="shrink-0 text-xs text-fd-muted-foreground">{projectName(e.project)}</span>
                </>
              );
              return (
                <li key={`${e.timestamp}-${i}`}>
                  {e.hasSession && e.slug && e.sessionId ? (
                    <Link
                      href={`/p/${e.slug}/session/${e.sessionId}`}
                      className="flex items-baseline gap-3 rounded border bg-fd-card px-3 py-1.5 hover:bg-fd-secondary"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-baseline gap-3 rounded border px-3 py-1.5 opacity-70">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 3: Create `app/global/history/page.tsx`

```tsx
import { DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getHistory } from '@/lib/claude/data';
import { HistoryTimeline } from '@/components/history-timeline';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const entries = await getHistory();

  return (
    <DocsPage>
      <DocsTitle>History</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">
        ~/.claude/history.jsonl · {entries.length} prompts
      </DocsDescription>
      <HistoryTimeline entries={entries} />
    </DocsPage>
  );
}
```

(No `DocsBody` — its prose styles fight the custom list layout; the session page
`app/p/[project]/session/[id]/page.tsx` already omits `DocsBody` the same way.)

**Verify**: `bun run types:check` → exit 0.

### Step 4: Sidebar entry

In `lib/claude/tree.ts`: import `getHistory` — no. Do NOT fetch full history for the sidebar
(it re-reads 139 KB per layout render). The sidebar entry is unconditional:

Insert **between** the `if (settings !== null) { ... }` block and the `if (plans.length > 0)`
block:

```ts
children.push({ type: 'page', name: 'History', url: '/global/history' });
```

(This lands History above Plans in the sidebar, matching the target order: Overview, CLAUDE.md,
Settings, History, Plans, Skills.)

**Verify**: `bun run types:check` → exit 0.

### Step 5: Verify in the dev server

Start `bun dev`, then:

```bash
curl -s http://localhost:3000/global/history | grep -c 'history.jsonl'
curl -s http://localhost:3000/global/history | grep -c '/session/'
curl -s http://localhost:3000/global/history | grep -c '<input'
curl -s http://localhost:3000/global | grep -c '/global/history'
```

**Verify**: all counts ≥ 1 (second confirms at least one entry linked to an existing session;
third confirms the search input server-rendered; fourth confirms the sidebar link). Then in a
browser: type a word you know you prompted recently — the list narrows; pick a project in the
dropdown — only its entries remain; click an entry — the session transcript opens.

## Test plan

No test framework in this repo; done criteria are the verification.

## Done criteria

- [ ] `bun run types:check` exits 0
- [ ] `/global/history` returns 200, renders grouped-by-day entries, search input present
- [ ] At least one entry links to `/p/<slug>/session/<id>` and that link returns 200
- [ ] Entries for deleted projects/sessions render without links (no dead `/p/...` hrefs for
      them — spot-check one `hasSession: false` case if present)
- [ ] Sidebar shows History between Settings and Plans
- [ ] `git status` clean outside in-scope files (pre-existing `CLAUDE.md` mod excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `history.jsonl` lines don't match the documented keys/types (e.g. `timestamp` is a string —
  would mean the format migrated).
- More than ~10% of entries with an existing project dir fail the slug match — the
  `replace(/[^a-zA-Z0-9]/g, '-')` encoding assumption would be wrong; report examples.
- Hydration-mismatch errors appear in the browser console for the timeline (server-formatted
  dates differing from client formatting).
- `buildGlobalTree()` lacks the plan-002 Settings block or plan-003 Plans block (anchors missing).

## Maintenance notes

- Date/time formatting uses explicit `en-US` with the machine's local timezone; server and
  browser run on the same machine for this app, so SSR and hydration agree. If the app is ever
  served remotely, this becomes a hydration-mismatch source — switch to formatting after mount.
- At ~10k history lines, add pagination or virtualization; the full-list SSR is the first thing
  that will feel slow.
- The "usage analytics" backlog item should consume `getHistory()` — keep its return shape stable.
- Reviewer: check no link is emitted when `hasSession` is false, and that the sidebar doesn't
  read history.jsonl.
