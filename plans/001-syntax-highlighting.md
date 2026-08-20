# Plan 001: Add syntax highlighting to the runtime Markdown component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat cc5f905..HEAD -- components/markdown.tsx app/global.css package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `cc5f905`, 2026-08-18

## Why this matters

The app renders markdown at runtime (memories, session transcripts, `~/.claude/CLAUDE.md`) through
a single `Markdown` component built on `react-markdown`. Code blocks inside that content currently
render as unstyled monochrome `<pre><code>`. Adding `rehype-highlight` gives every downstream
renderer highlighted code in one change — and every later plan (plans browser, skills browser)
inherits it for free. Note this component is NOT used by the MDX docs under `app/docs/`, which have
their own shiki pipeline via fumadocs; nothing there changes.

## Current state

- This is a Next.js 16 / Fumadocs app using **bun**. No tests, no linter. Typecheck is the only
  gate: `bun run types:check` (runs `next typegen && tsc --noEmit`).
- `components/markdown.tsx` — the entire file today:

  ```tsx
  import ReactMarkdown from 'react-markdown';
  import remarkGfm from 'remark-gfm';

  export function Markdown({ text }: { text: string }) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
  }
  ```

- `app/global.css` — the entire file today:

  ```css
  @import 'tailwindcss';
  @import 'fumadocs-ui/css/neutral.css';
  @import 'fumadocs-ui/css/preset.css';

  html {
    scrollbar-gutter: stable;
  }

  html > body[data-scroll-locked] {
    margin-right: 0px !important;
    --removed-body-scroll-bar-size: 0px !important;
  }
  ```

- Dark mode: fumadocs' `RootProvider` (see `app/layout.tsx`) uses next-themes with
  `attribute: "class"` — dark mode is the `.dark` class on `<html>`. Do NOT use
  `data-theme` selectors or `prefers-color-scheme`; they will not track the in-app theme toggle.
- `package.json` dependencies include `react-markdown ^10.1.0` and `remark-gfm ^4.0.1`.
  `rehype-highlight` is not installed.
- Repo warning from `AGENTS.md`: this Next.js version has breaking changes vs. training data;
  if unsure about a Next API, read `node_modules/next/dist/docs/`. This plan touches no Next
  APIs, so that mostly doesn't apply here.
- `next dev` regenerates an agent-instructions block in `AGENTS.md`. If `AGENTS.md` shows as
  modified after you run the dev server, include it in your commit (per the note inside
  `AGENTS.md` itself).
- The working tree already has an uncommitted modification to `CLAUDE.md` that predates this
  plan. Do NOT commit or revert it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install dep | `bun add rehype-highlight` | exit 0, `package.json` updated |
| Typecheck | `bun run types:check`    | exit 0, no errors   |
| Dev server | `bun dev` (background)  | serves on http://localhost:3000 |

## Scope

**In scope** (the only files you should modify):
- `components/markdown.tsx`
- `app/global.css`
- `package.json` + `bun.lock` (via `bun add`)
- `AGENTS.md` (only if `next dev` regenerates it)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `app/docs/**`, `lib/source.ts`, `content/**` — the MDX docs pipeline has its own shiki
  highlighting; adding rehype-highlight there would double-highlight.
- `components/transcript.tsx` — the `<pre>` blocks for tool input/output are raw JSON/text,
  not fenced markdown; they are handled in plan 006, not here.

## Git workflow

- Work directly on `main` (repo convention — recent commits land on main).
- One commit at the end. Message style matches `git log`: short `Thing: description` line, e.g.
  `Syntax highlighting: rehype-highlight in runtime Markdown renderer`. Do NOT push.

## Steps

### Step 1: Install rehype-highlight

Run `bun add rehype-highlight`.

**Verify**: `ls node_modules/rehype-highlight && bun run types:check` → both succeed, exit 0.

### Step 2: Wire the plugin into the Markdown component

Replace `components/markdown.tsx` with:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
      {text}
    </ReactMarkdown>
  );
}
```

**Verify**: `bun run types:check` → exit 0.

### Step 3: Add scoped highlight token colors to global.css

Append this block to the end of `app/global.css` (GitHub light/dark palettes; the `.dark`
selectors track fumadocs' theme class):

```css
/* highlight.js token colors for runtime markdown (rehype-highlight) */
.hljs-comment,
.hljs-quote {
  color: #6a737d;
}
.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #d73a49;
}
.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
  color: #005cc5;
}
.hljs-string,
.hljs-doctag,
.hljs-regexp {
  color: #032f62;
}
.hljs-title,
.hljs-section,
.hljs-selector-id {
  color: #6f42c1;
}
.hljs-type,
.hljs-built_in {
  color: #e36209;
}
.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #22863a;
}
.hljs-meta {
  color: #735c0f;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-strong {
  font-weight: bold;
}

.dark .hljs-comment,
.dark .hljs-quote {
  color: #8b949e;
}
.dark .hljs-keyword,
.dark .hljs-selector-tag,
.dark .hljs-subst {
  color: #ff7b72;
}
.dark .hljs-number,
.dark .hljs-literal,
.dark .hljs-variable,
.dark .hljs-template-variable,
.dark .hljs-tag .hljs-attr {
  color: #79c0ff;
}
.dark .hljs-string,
.dark .hljs-doctag,
.dark .hljs-regexp {
  color: #a5d6ff;
}
.dark .hljs-title,
.dark .hljs-section,
.dark .hljs-selector-id {
  color: #d2a8ff;
}
.dark .hljs-type,
.dark .hljs-built_in {
  color: #ffa657;
}
.dark .hljs-tag,
.dark .hljs-name,
.dark .hljs-attribute {
  color: #7ee787;
}
.dark .hljs-meta {
  color: #d29922;
}
```

**Verify**: `bun run types:check` → exit 0 (CSS isn't typechecked, this just confirms nothing broke).

### Step 4: Verify against real data in the dev server

1. Start the dev server in the background: `bun dev`.
2. Find a memory file containing a fenced code block and derive its URL:

   ```bash
   grep -rl '```' ~/.claude/projects/*/memory/*.md | head -3
   ```

   For a hit like `~/.claude/projects/<slug>/memory/<file>.md`, the page URL is
   `http://localhost:3000/p/<slug>/memory/<file>.md`.
3. Fetch it and confirm hljs classes are in the server-rendered HTML:

   ```bash
   curl -s "http://localhost:3000/p/<slug>/memory/<file>.md" | grep -c 'class="hljs'
   ```

**Verify**: the `grep -c` count is ≥ 1. If NO memory file anywhere contains a code fence, fall
back to any session transcript page (assistant markdown frequently contains fences): pick a
session URL from a project page and run the same grep.

Then open the page in a browser, toggle the theme (button in the layout), and confirm code colors
change between light and dark. This one check is visual; everything else is command-checkable.

## Test plan

No test framework exists in this repo (verified during recon) and this plan does not introduce
one. The done criteria below are the full verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run types:check` exits 0
- [ ] `grep -c 'rehypeHighlight' components/markdown.tsx` → 2 (import + usage)
- [ ] `grep -c 'hljs-keyword' app/global.css` → 2 (light + dark rule)
- [ ] `curl -s` of a page with a code fence contains `class="hljs` (Step 4)
- [ ] `git status` shows no modified files outside the in-scope list (pre-existing `CLAUDE.md`
      modification excepted)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `components/markdown.tsx` or `app/global.css` no longer match the "Current state" excerpts.
- Rendering a page throws an error mentioning an unknown/unregistered language (rehype-highlight
  can throw for code fences tagged with a language it doesn't know). Report the language name; the
  likely fix — passing options like `[rehypeHighlight, { plainText: ['<lang>'] }]` — needs a human
  to confirm the option shape for the installed version. Do not guess options into the code.
- `bun add rehype-highlight` fails or resolves a major version other than 7.x (the plan's
  usage assumes the v7 plugin signature).
- Highlighting appears in light mode but dark mode shows unreadable colors after theme toggle
  (would mean the `.dark` scoping assumption broke).

## Maintenance notes

- Plan 006 switches user transcript messages to this `Markdown` component; they inherit
  highlighting automatically. Plans 003/004 render plan/skill markdown through it too.
- If someone later adds line numbers or copy buttons, prefer fumadocs' shiki pipeline patterns
  over growing this component — this component is deliberately the "cheap runtime" renderer.
- Reviewer should scrutinize: that `app/docs` MDX pages are unaffected (no double-highlight),
  and bundle size (rehype-highlight's common-language set ships to the client only if a client
  component uses `Markdown`; today all users are server components, so HTML is server-rendered).
