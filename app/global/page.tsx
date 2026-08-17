import Link from 'next/link';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getGlobalClaudeMd, listAllMemories } from '@/lib/claude/data';
import { projectDisplayName } from '@/lib/claude/tree';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [claudeMd, groups] = await Promise.all([getGlobalClaudeMd(), listAllMemories()]);
  const total = groups.reduce((n, g) => n + g.memories.length, 0);

  return (
    <DocsPage>
      <DocsTitle>Global</DocsTitle>
      <DocsDescription className="mb-0">
        Instructions and memories that live in ~/.claude, across all projects.
      </DocsDescription>
      <DocsBody>
        <h2>Instructions</h2>
        {claudeMd !== null ? (
          <p>
            <Link href="/global/claude-md">CLAUDE.md</Link> — global instructions applied to every project.
          </p>
        ) : (
          <p>No ~/.claude/CLAUDE.md found.</p>
        )}

        <h2>
          Memories ({total} across {groups.length} projects)
        </h2>
        {groups.map((g) => (
          <section key={g.slug}>
            <h3>
              <Link href={`/p/${g.slug}`}>{projectDisplayName(g.realPath, g.slug)}</Link>
            </h3>
            <ul>
              {g.memories.map((m) => (
                <li key={m.file}>
                  <Link href={`/p/${g.slug}/memory/${encodeURIComponent(m.file)}`}>{m.title}</Link>
                  {m.description && <span className="text-fd-muted-foreground"> — {m.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DocsBody>
    </DocsPage>
  );
}
