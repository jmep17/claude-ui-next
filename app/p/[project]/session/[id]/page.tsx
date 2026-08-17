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
