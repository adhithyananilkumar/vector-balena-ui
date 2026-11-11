import overview from './content/overview.md?raw';
import quickStart from './content/quick-start.md?raw';
import uiTour from './content/ui-tour.md?raw';
import installCli from './content/install-cli.md?raw';
import connectCli from './content/connect-cli.md?raw';
import deployLocal from './content/deploy-local.md?raw';
import multiArch from './content/multi-arch.md?raw';
import releasesRollouts from './content/releases-rollouts.md?raw';
import ciAutomation from './content/ci-automation.md?raw';
import addDevice from './content/add-device.md?raw';
import deviceDashboard from './content/device-dashboard.md?raw';
import remoteAccess from './content/remote-access.md?raw';
import accessControl from './content/access-control.md?raw';
import configuration from './content/configuration.md?raw';
import serverSetup from './content/server-setup.md?raw';
import certificatesDns from './content/certificates-dns.md?raw';
import cliCheatsheet from './content/cli-cheatsheet.md?raw';
import troubleshooting from './content/troubleshooting.md?raw';
import glossary from './content/glossary.md?raw';
import { extractHeadings, stripInline, type Heading } from './markdown';

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  source: string;
  headings: Heading[];
  /** Plain text of the whole page (no markdown), used for search. */
  plainText: string;
}

interface DocDefinition {
  slug: string;
  section: string;
  description: string;
  source: string;
}

/** Sections, in the order they appear in the sidebar. */
export const docSections = ['Start here', 'Deploy', 'Devices', 'Administration', 'Reference'] as const;

const definitions: DocDefinition[] = [
  { slug: 'overview', section: 'Start here', description: 'What Vector is and how the pieces fit together.', source: overview },
  { slug: 'quick-start', section: 'Start here', description: 'From nothing to a running deployment on one device.', source: quickStart },
  { slug: 'ui-tour', section: 'Start here', description: 'The sidebar, top bar, lists and shortcuts.', source: uiTour },

  { slug: 'install-cli', section: 'Deploy', description: 'Install Docker and the balena CLI on Windows, macOS or Linux.', source: installCli },
  { slug: 'connect-cli', section: 'Deploy', description: 'Point the CLI at your server, trust the certificate and log in.', source: connectCli },
  { slug: 'deploy-local', section: 'Deploy', description: 'Build on your computer, push to Vector, distribute to devices.', source: deployLocal },
  { slug: 'multi-arch', section: 'Deploy', description: 'Build for ARM devices from an Intel PC, and the reverse.', source: multiArch },
  { slug: 'releases-rollouts', section: 'Deploy', description: 'Draft releases, pinning, rollback and staged rollouts.', source: releasesRollouts },
  { slug: 'ci-automation', section: 'Deploy', description: 'Deploy from GitHub Actions or a build machine.', source: ciAutomation },

  { slug: 'add-device', section: 'Devices', description: 'Create a flash-ready image and bring a device online.', source: addDevice },
  { slug: 'device-dashboard', section: 'Devices', description: 'Services, logs, variables, tags and update progress.', source: deviceDashboard },
  { slug: 'remote-access', section: 'Devices', description: 'Browser terminal and file transfer for any device.', source: remoteAccess },

  { slug: 'server-setup', section: 'Administration', description: 'Install the openBalena backend on a Linux server.', source: serverSetup },
  { slug: 'certificates-dns', section: 'Administration', description: 'DNS names, certificates, time and firewall ports.', source: certificatesDns },
  { slug: 'configuration', section: 'Administration', description: 'Every environment variable of the Vector UI.', source: configuration },
  { slug: 'access-control', section: 'Administration', description: 'Roles, organizations, API keys and the safe setup.', source: accessControl },

  { slug: 'cli-cheatsheet', section: 'Reference', description: 'The balena CLI and server commands you will use most.', source: cliCheatsheet },
  { slug: 'troubleshooting', section: 'Reference', description: 'Symptoms, causes and fixes for common problems.', source: troubleshooting },
  { slug: 'glossary', section: 'Reference', description: 'Short definitions of the terms used in Vector.', source: glossary },
];

const titleOf = (source: string, fallback: string): string => {
  const match = /^#\s+(.+?)\s*$/m.exec(source);
  return match ? stripInline(match[1]) : fallback;
};

/** Readable plain text of a page (no markdown symbols), used for search and snippets. */
const toPlainText = (source: string): string =>
  stripInline(source)
    .replace(/^\s*```.*$/gm, ' ')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^\s*>\s?(\[![A-Z]+\])?/gm, '')
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

export const docs: DocPage[] = definitions.map((definition) => {
  const title = titleOf(definition.source, definition.slug);
  return {
    ...definition,
    title,
    headings: extractHeadings(definition.source),
    plainText: `${title}. ${definition.description} ${toPlainText(definition.source)}`,
  };
});

export const findDoc = (slug: string | undefined): DocPage | undefined => docs.find((doc) => doc.slug === slug);

export interface SearchHit {
  doc: DocPage;
  score: number;
  snippet: string;
}

/** Simple full-text search: every word must appear; title and heading matches rank higher. */
export const searchDocs = (query: string, limit = 12): SearchHit[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const haystack = doc.plainText.toLowerCase();
    if (!words.every((word) => haystack.includes(word))) continue;
    const title = doc.title.toLowerCase();
    const headingText = doc.headings.map((heading) => heading.text.toLowerCase()).join('\n');
    let score = 0;
    for (const word of words) {
      if (title.includes(word)) score += 10;
      if (headingText.includes(word)) score += 4;
      score += Math.min(5, haystack.split(word).length - 1);
    }
    const at = haystack.indexOf(words[0]);
    const start = Math.max(0, at - 50);
    const end = start + 150;
    const text = doc.plainText.slice(start, end).trim();
    hits.push({ doc, score, snippet: `${start > 0 ? '…' : ''}${text}${end < doc.plainText.length ? '…' : ''}` });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
};
