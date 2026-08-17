import Link from 'next/link';
import { listProjects } from '@/lib/claude/data';

export const dynamic = 'force-dynamic';

function displayName(realPath: string | null, slug: string): string {
  if (realPath) return realPath.replace(/^\/Users\/[^/]+/, '~');
  return slug;
}

export default async function HomePage() {
  const projects = await listProjects();
  const active = projects.filter((p) => p.sessionCount > 0 || p.memoryCount > 0);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Projects</h1>
      <p className="mb-8 text-sm text-fd-muted-foreground">
        {active.length} projects in ~/.claude/projects
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/global"
          className="rounded-lg border border-fd-primary/40 bg-fd-card px-4 py-3 transition-colors hover:bg-fd-accent"
        >
          <div className="font-mono text-sm font-medium">Global</div>
          <div className="mt-1 text-xs text-fd-muted-foreground">
            ~/.claude/CLAUDE.md and memories across all projects
          </div>
        </Link>
        {active.map((p) => (
          <Link
            key={p.slug}
            href={`/p/${p.slug}`}
            className="rounded-lg border bg-fd-card px-4 py-3 transition-colors hover:bg-fd-accent"
          >
            <div className="truncate font-mono text-sm font-medium">{displayName(p.realPath, p.slug)}</div>
            <div className="mt-1 text-xs text-fd-muted-foreground">
              {p.sessionCount} sessions · {p.memoryCount} memories
              {p.lastActive && ` · last active ${p.lastActive.toLocaleDateString()}`}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
