# Plan 006: Transcript improvements — timestamps, user markdown, session metadata header

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- lib/claude/data.ts components/transcript.tsx app/p`
> Plans 001–005 may have landed; they add functions to `data.ts` but do NOT touch the transcript
> section (`TranscriptBlock`, `Transcript`, `readTranscript`), `components/transcript.tsx`, or
> `app/p/**`. Any divergence in THOSE from the excerpts below is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the most-used view; parsing changes can silently drop blocks)
- **Depends on**: 001 soft (user-message markdown gains code highlighting only if 001 landed)
- **Category**: dx
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

The session transcript viewer is the app's core feature, and it currently drops information the
JSONL already carries: when each message happened, what model/branch/version the session ran on,
and how long it lasted. User messages also render as plain preformatted text even though users
type markdown. Three improvements: (a) show timestamps, (b) render user messages as markdown,
(c) add a session metadata header.

## Current state — data on disk (verified 2026-08-18)

Transcript JSONL entries (one per line) at `~/.claude/projects/<slug>/<sessionId>.jsonl`:

- `user` entries carry top-level keys including `timestamp` (ISO 8601 string, e.g.
  `"2026-08-18T08:59:41.755Z"`), `version` (Claude Code version, e.g. `"2.1.233"`),
  `gitBranch` (e.g. `"main"`), `cwd`, `isMeta`.
- `assistant` entries carry the same top-level `timestamp`/`version`/`gitBranch` plus
  `message.model` (e.g. `"claude-fable-5"`).
- Sessions also contain non-message entry types (`mode`, bridge records, etc.) with
  `timestamp: null` or absent — metadata extraction must skip null/non-string timestamps.
- The LAST line of a file is not guaranteed to be a message entry or even valid JSON.

## Current state — code

- Next.js 16 / Fumadocs app, **bun**. No tests/linter. Gate: `bun run types:check`.
- `lib/claude/data.ts` — transcript types (lines 36-47 at planning time):

  ```ts
  export type TranscriptBlock =
    | { kind: 'text'; role: 'user' | 'assistant'; text: string; timestamp?: string }
    | { kind: 'thinking'; text: string }
    | { kind: 'tool-use'; name: string; input: unknown; id: string }
    | { kind: 'tool-result'; toolUseId: string; text: string; isError: boolean };

  export interface Transcript {
    blocks: TranscriptBlock[];
    totalLines: number;
    skippedLines: number;
    truncated: boolean;
  }
  ```

  `readTranscript(slug, id)` (lines 279-346): validates `id` against `/^[\w-]+$/`, reads the
  whole file, iterates lines with per-line `JSON.parse` in try/catch, pushes blocks, stops at
  `MAX_BLOCKS = 2000` setting `truncated = true`. Only `text` blocks get `timestamp` today.
  Inside the loop: user entries are handled at `entry.type === 'user' && !entry.isMeta`,
  assistant entries at `entry.type === 'assistant'`; everything else increments `skippedLines`.

- `components/transcript.tsx` — the user text branch (lines 12-20):

  ```tsx
  case 'text':
    if (block.role === 'user') {
      return (
        <div className="rounded-lg border bg-fd-secondary px-4 py-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">User</div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm">{clamp(block.text)}</div>
        </div>
      );
    }
  ```

  The file also has `CLAMP = 4000` truncation via `clamp()`, and `<details>` blocks for
  thinking/tool-use/tool-result. It is a server component (no `'use client'`), imports
  `Markdown` from `./markdown` (used for assistant text).

- `app/p/[project]/session/[id]/page.tsx` — whole file:

  ```tsx
  import { notFound } from 'next/navigation';
  import { DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
  import { readTranscript } from '@/lib/claude/data';
  import { Transcript } from '@/components/transcript';

  export const dynamic = 'force-dynamic';

  export default async function Page({
    params,
  }: {
    params: Promise<{ project: string; id: string }>;
  }) {
    const { project, id } = await params;
    const transcript = await readTranscript(project, id);
    if (!transcript) notFound();

    return (
      <DocsPage>
        <DocsTitle>Session</DocsTitle>
        <DocsDescription className="mb-0 font-mono text-xs">{id}</DocsDescription>
        {transcript.truncated && (
          <p className="rounded border border-fd-primary/50 bg-fd-card px-3 py-2 text-sm">
            Long session — showing the first {transcript.blocks.length} blocks of {transcript.totalLines} lines.
          </p>
        )}
        <Transcript blocks={transcript.blocks} />
      </DocsPage>
    );
  }
  ```

- Deterministic date formatting convention: explicit `'en-US'` locale (see `shortDate` in
  `lib/claude/tree.ts:6-8`).
- `react-markdown` escapes raw HTML by default — user messages containing `<tags>` (system
  reminders, pasted XML) render as literal text, not injected HTML. This is the safe default;
  do not add `rehype-raw`.
- `AGENTS.md`: Next version differs from training data; patterns here are existing ones.
  `next dev` may regenerate `AGENTS.md` (commit if so). Pre-existing uncommitted `CLAUDE.md`
  change: leave alone.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run types:check`    | exit 0              |
| Dev server | `bun dev` (background)  | http://localhost:3000 |

## Scope

**In scope** (only these):
- `lib/claude/data.ts` — ONLY the transcript section: `TranscriptBlock`, `Transcript`, new
  `SessionMetadata`, `readTranscript`.
- `components/transcript.tsx`
- `app/p/[project]/session/[id]/page.tsx`
- `AGENTS.md` (only if regenerated), `plans/README.md` (status row)

**Out of scope**:
- Every other function in `data.ts` (including anything plans 002–005 added).
- `components/markdown.tsx` (owned by plan 001).
- Rendering images/subagent trees in transcripts (future backlog).
- Raising `MAX_BLOCKS` or `CLAMP`.

## Git workflow

- Work on `main`. One commit, e.g.
  `Transcript: timestamps, user markdown, session metadata header`. Do NOT push.

## Steps

### Step 1: Extend types and metadata extraction in lib/claude/data.ts

1. Give every `TranscriptBlock` variant an optional timestamp:

   ```ts
   export type TranscriptBlock =
     | { kind: 'text'; role: 'user' | 'assistant'; text: string; timestamp?: string }
     | { kind: 'thinking'; text: string; timestamp?: string }
     | { kind: 'tool-use'; name: string; input: unknown; id: string; timestamp?: string }
     | { kind: 'tool-result'; toolUseId: string; text: string; isError: boolean; timestamp?: string };
   ```

2. Add the metadata interface and extend `Transcript`:

   ```ts
   export interface SessionMetadata {
     model: string | null;
     version: string | null;
     gitBranch: string | null;
     /** ISO 8601 strings from the first/last timestamped entries. */
     startedAt: string | null;
     endedAt: string | null;
     userMessages: number;
     assistantMessages: number;
     toolUses: number;
   }

   export interface Transcript {
     blocks: TranscriptBlock[];
     meta: SessionMetadata;
     totalLines: number;
     skippedLines: number;
     truncated: boolean;
   }
   ```

3. In `readTranscript`, before the loop, initialize:

   ```ts
   const meta: SessionMetadata = {
     model: null, version: null, gitBranch: null,
     startedAt: null, endedAt: null,
     userMessages: 0, assistantMessages: 0, toolUses: 0,
   };
   ```

   Inside the loop, right after the successful `JSON.parse` (before the type branches), collect
   from every entry:

   ```ts
   if (typeof entry.timestamp === 'string') {
     meta.startedAt ??= entry.timestamp;
     meta.endedAt = entry.timestamp;
   }
   if (meta.version === null && typeof entry.version === 'string') meta.version = entry.version;
   if (meta.gitBranch === null && typeof entry.gitBranch === 'string') meta.gitBranch = entry.gitBranch;
   if (meta.model === null && entry.type === 'assistant' && typeof entry.message?.model === 'string') {
     meta.model = entry.message.model;
   }
   ```

4. Thread `timestamp: entry.timestamp` into the block constructors that lack it: the
   `tool-result` push in the user branch, and the `thinking` and `tool-use` pushes in the
   assistant branch (the `text` pushes already have it).

5. After the loop: if `truncated`, recover the real end time by scanning backwards over at most
   the last 20 lines for a parseable entry with a string `timestamp`, assigning it to
   `meta.endedAt`. Then derive counts from the blocks actually parsed:

   ```ts
   for (const b of blocks) {
     if (b.kind === 'text' && b.role === 'user') meta.userMessages++;
     else if (b.kind === 'text' && b.role === 'assistant') meta.assistantMessages++;
     else if (b.kind === 'tool-use') meta.toolUses++;
   }
   ```

6. Return `{ blocks, meta, totalLines: lines.length, skippedLines, truncated }`.

**Verify**: `bun run types:check` → exit 0.

### Step 2: Timestamps + user markdown in components/transcript.tsx

1. Add a formatter near `clamp` (explicit locale per repo convention):

   ```tsx
   function blockTime(timestamp?: string): string | null {
     if (!timestamp) return null;
     const d = new Date(timestamp);
     if (Number.isNaN(d.getTime())) return null;
     return d.toLocaleTimeString('en-US', { hour12: false });
   }
   ```

2. Replace the user text branch with (label row gains the time; body becomes markdown —
   `whitespace-pre-wrap` is removed because `Markdown` handles paragraphs):

   ```tsx
   if (block.role === 'user') {
     const time = blockTime(block.timestamp);
     return (
       <div className="rounded-lg border bg-fd-secondary px-4 py-3">
         <div className="mb-1 flex items-baseline justify-between">
           <span className="text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">User</span>
           {time && <span className="font-mono text-xs text-fd-muted-foreground">{time}</span>}
         </div>
         <div className="prose prose-sm max-w-none break-words text-sm">
           <Markdown text={clamp(block.text)} />
         </div>
       </div>
     );
   }
   ```

   Interpretation note (from the draft roadmap's "timestamps next to role label"): the user
   label is the only role label in the UI, so the visible timestamp lives there — it marks each
   conversation turn. Other block kinds carry `timestamp` in data (step 1.4) but get no visible
   timestamp in this plan.

**Verify**: `bun run types:check` → exit 0.

### Step 3: Metadata header in app/p/[project]/session/[id]/page.tsx

Add helpers above the component:

```tsx
function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
```

Between the `DocsDescription` and the truncation notice, insert:

```tsx
<div className="flex flex-wrap gap-x-4 gap-y-1 rounded border bg-fd-card px-3 py-2 font-mono text-xs text-fd-muted-foreground">
  {transcript.meta.model && <span>{transcript.meta.model}</span>}
  {transcript.meta.version && <span>v{transcript.meta.version}</span>}
  {transcript.meta.gitBranch && <span>⎇ {transcript.meta.gitBranch}</span>}
  {formatDuration(transcript.meta.startedAt, transcript.meta.endedAt) && (
    <span>{formatDuration(transcript.meta.startedAt, transcript.meta.endedAt)}</span>
  )}
  <span>
    {transcript.meta.userMessages} user · {transcript.meta.assistantMessages} assistant ·{' '}
    {transcript.meta.toolUses} tools
  </span>
</div>
```

**Verify**: `bun run types:check` → exit 0.

### Step 4: Verify in the dev server against a real session

Start `bun dev`, then pick the newest transcript of any project and build its URL:

```bash
d=$(ls -td ~/.claude/projects/*/ | head -1)
slug=$(basename "$d")
id=$(ls -t "$d"/*.jsonl | head -1 | xargs basename | sed 's/\.jsonl$//')
url="http://localhost:3000/p/$slug/session/$id"
echo "$url"
curl -s "$url" | grep -c 'claude-'
curl -s "$url" | grep -cE '[0-9]{2}:[0-9]{2}:[0-9]{2}'
curl -s "$url" | grep -c ' user · '
```

**Verify**: all three counts ≥ 1 (model id rendered; at least one block timestamp; counts line
present). Also load one memory page and one project overview to confirm nothing else broke
(`curl -s -o /dev/null -w '%{http_code}\n'` → `200`).

## Test plan

No test framework in this repo; done criteria are the verification. When comparing before/after,
`skippedLines` for a given session must not increase (metadata extraction must not consume or
reject entries the old parser accepted).

## Done criteria

- [ ] `bun run types:check` exits 0
- [ ] Session page shows the metadata bar with model, version, branch, duration, and counts for
      a real session (Step 4 greps)
- [ ] User messages render as markdown (a user message containing a fenced code block shows
      `<pre>`/`<code>`, not literal backticks — find one via
      `grep -l '"type":"user"' ~/.claude/projects/*/[0-9a-f]*.jsonl | head` and spot-check, or
      confirm on any session where you know markdown was typed)
- [ ] A user message containing `<system-reminder>` style tags renders them as visible text
      (react-markdown escaping intact)
- [ ] `git status` clean outside in-scope files (pre-existing `CLAUDE.md` mod excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The transcript section of `data.ts`, `components/transcript.tsx`, or the session page doesn't
  match the "Current state" excerpts.
- After the change, any session page renders fewer blocks than before (compare block count for
  one long session before/after via `grep -c 'rounded-lg border' page.html` or similar) — the
  metadata collection must be purely additive to the parse loop.
- Timestamps render but are obviously wrong (e.g. all identical, or dates in 1970 — would mean
  an epoch-ms vs ISO-string mixup; transcript timestamps are ISO strings).
- Markdown rendering of user messages visibly mangles a common message shape (e.g. big pasted
  logs collapsing into one paragraph is acceptable; content disappearing is not).

## Maintenance notes

- Timestamps format with the server's local timezone (server component — no hydration concern).
  If transcripts are ever rendered client-side, revisit.
- The metadata bar reads only `transcript.meta`; the future "subagent viewer" backlog item will
  want `meta` extended (e.g. sidechain counts) — extend `SessionMetadata`, don't parse in the page.
- User messages switching from pre-wrap to markdown changes how whitespace-heavy pastes look;
  if users complain, the escape hatch is a heuristic (render as markdown only when the text
  contains markdown tokens) — deliberately not built now.
- Reviewer: check `skippedLines` behavior is unchanged and the truncated-session `endedAt`
  backward scan is bounded (20 lines).
