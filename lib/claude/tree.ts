import type { Root, Node } from 'fumadocs-core/page-tree';
import { listMemories, listSessions } from './data';

const SIDEBAR_SESSION_LIMIT = 40;

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function sessionLabel(mtime: Date, firstPrompt: string | null): string {
  const snippet = firstPrompt ? firstPrompt.slice(0, 40) : 'no prompt';
  return `${shortDate(mtime)} · ${snippet}`;
}

export async function buildProjectTree(slug: string, displayName: string): Promise<Root> {
  const [memories, sessions] = await Promise.all([listMemories(slug), listSessions(slug)]);
  const base = `/p/${slug}`;

  const children: Node[] = [{ type: 'page', name: 'Overview', url: base }];

  if (memories.length > 0) {
    children.push({ type: 'separator', name: 'Memory' });
    for (const m of memories) {
      children.push({
        type: 'page',
        name: m.title,
        url: `${base}/memory/${encodeURIComponent(m.file)}`,
      });
    }
  }

  if (sessions.length > 0) {
    children.push({ type: 'separator', name: `Sessions (${sessions.length})` });
    for (const s of sessions.slice(0, SIDEBAR_SESSION_LIMIT)) {
      children.push({
        type: 'page',
        name: sessionLabel(s.mtime, s.firstPrompt),
        url: `${base}/session/${s.id}`,
      });
    }
  }

  return { name: displayName, children };
}
