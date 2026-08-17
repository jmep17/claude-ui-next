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
