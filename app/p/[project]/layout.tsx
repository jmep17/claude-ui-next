import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { getProject } from '@/lib/claude/data';
import { buildProjectTree } from '@/lib/claude/tree';

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const summary = await getProject(project);
  if (!summary) notFound();

  const displayName = summary.realPath?.split('/').pop() ?? project;
  const tree = await buildProjectTree(project, displayName);

  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
