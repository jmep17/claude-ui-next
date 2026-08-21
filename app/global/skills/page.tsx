import Link from 'next/link';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { listSkills } from '@/lib/claude/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const skills = await listSkills();
  const sources = [...new Set(skills.map((s) => s.source))];

  return (
    <DocsPage>
      <DocsTitle>Skills</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">
        ~/.claude/skills + installed plugins · {skills.length} skills
      </DocsDescription>
      <DocsBody>
        {skills.length === 0 && <p>No skills found.</p>}
        {sources.map((source) => (
          <section key={source}>
            <h2>{source === 'user' ? 'Your skills' : source}</h2>
            <ul>
              {skills
                .filter((s) => s.source === source)
                .map((s) => (
                  <li key={s.id}>
                    <Link href={`/global/skills/${encodeURIComponent(s.id)}`}>{s.name}</Link>
                    {s.description && <span className="text-fd-muted-foreground"> — {s.description}</span>}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </DocsBody>
    </DocsPage>
  );
}
