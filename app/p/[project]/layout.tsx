import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { getProject } from '@/lib/claude/data';
import { buildProjectTree, projectDisplayName } from '@/lib/claude/tree';

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

  const tree = await buildProjectTree(project, projectDisplayName(summary.realPath, project));

  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
