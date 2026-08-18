import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { getSettings } from '@/lib/claude/data';

export const dynamic = 'force-dynamic';

const SECTIONS: [title: string, keys: string[]][] = [
  ['Model', ['model', 'effortLevel', 'autoMode']],
  ['Permissions', ['permissions']],
  ['Hooks', ['hooks']],
  ['Plugins', ['enabledPlugins', 'extraKnownMarketplaces']],
  [
    'Interface',
    [
      'editorMode',
      'tui',
      'statusLine',
      'voice',
      'voiceEnabled',
      'inputNeededNotifEnabled',
      'agentPushNotifEnabled',
      'showClearContextOnPlanAccept',
    ],
  ],
];

export default async function Page() {
  const settings = await getSettings();
  if (settings === null) notFound();

  const known = new Set(SECTIONS.flatMap(([, keys]) => keys));
  const other = Object.keys(settings).filter((k) => !known.has(k));
  const sections: [string, string[]][] = [...SECTIONS, ['Other', other]];

  return (
    <DocsPage>
      <DocsTitle>Settings</DocsTitle>
      <DocsDescription className="mb-0 font-mono text-xs">~/.claude/settings.json</DocsDescription>
      <DocsBody>
        {sections.map(([title, keys]) => {
          const present = keys.filter((k) => k in settings);
          if (present.length === 0) return null;
          return (
            <section key={title}>
              <h2>{title}</h2>
              {present.map((key) => (
                <div key={key} className="mb-4">
                  <div className="mb-1 font-mono text-xs text-fd-muted-foreground">{key}</div>
                  <pre className="overflow-x-auto rounded bg-fd-secondary p-2 text-xs">
                    {JSON.stringify(settings[key], null, 2)}
                  </pre>
                </div>
              ))}
            </section>
          );
        })}
      </DocsBody>
    </DocsPage>
  );
}
