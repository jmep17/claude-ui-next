import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getMemory } from '@/lib/claude/data';
import { Markdown } from '@/components/markdown';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ project: string; file: string }>;
}) {
  const { project, file } = await params;
  const memory = await getMemory(project, decodeURIComponent(file));
  if (!memory) notFound();

  return (
    <DocsPage>
      <DocsTitle>{memory.title}</DocsTitle>
      {memory.description && <DocsDescription className="mb-0">{memory.description}</DocsDescription>}
      {memory.type && (
        <span className="w-fit rounded-full border px-2 py-0.5 text-xs text-fd-muted-foreground">{memory.type}</span>
      )}
      <DocsBody>
        <Markdown text={memory.content} />
      </DocsBody>
    </DocsPage>
  );
}
