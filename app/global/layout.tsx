import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { buildGlobalTree } from '@/lib/claude/tree';

export default async function Layout({ children }: { children: ReactNode }) {
  const tree = await buildGlobalTree();

  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
