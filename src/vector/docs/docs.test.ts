import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { extractHeadings, parseBlocks, slugify } from './markdown';

const contentDir = join(dirname(fileURLToPath(import.meta.url)), 'content');
const files = readdirSync(contentDir).filter((name) => name.endsWith('.md'));
const sources = new Map(files.map((name) => [name.replace(/\.md$/, ''), readFileSync(join(contentDir, name), 'utf8')]));

describe('markdown parser', () => {
  it('parses headings, code fences, tables, lists and callouts', () => {
    const blocks = parseBlocks(
      ['# Title', '', 'Text with `code`.', '', '```bash', '# not a heading', '```', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', '- one', '- two', '', '> [!WARNING]', '> careful'].join('\n'),
    );
    assert.deepEqual(
      blocks.map((block) => block.type),
      ['heading', 'paragraph', 'code', 'table', 'list', 'quote'],
    );
  });

  it('ignores headings inside code fences when building the table of contents', () => {
    const headings = extractHeadings('## One\n\n```bash\n## fake\n```\n\n## One\n\n### Sub');
    assert.deepEqual(
      headings.map((heading) => heading.id),
      ['one', 'one-1', 'sub'],
    );
  });

  it('slugifies like GitHub for numbered headings', () => {
    assert.equal(slugify('2. Trust your certificate authority'), '2-trust-your-certificate-authority');
  });
});

describe('docs content', () => {
  it('has a single top-level title in every page', () => {
    for (const [slug, source] of sources) {
      const titles = parseBlocks(source).filter((block) => block.type === 'heading' && block.level === 1);
      assert.equal(titles.length, 1, `${slug} must have exactly one # title`);
    }
  });

  it('only links to pages and sections that exist', () => {
    const problems: string[] = [];
    for (const [slug, source] of sources) {
      for (const match of source.matchAll(/\]\(doc:([a-z0-9-]+)(?:#([^)]+))?\)/g)) {
        const [, target, anchor] = match;
        const targetSource = sources.get(target);
        if (!targetSource) {
          problems.push(`${slug} -> missing page "${target}"`);
        } else if (anchor && !extractHeadings(targetSource).some((heading) => heading.id === anchor)) {
          problems.push(`${slug} -> missing section "${target}#${anchor}"`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });

  it('closes every code fence', () => {
    for (const [slug, source] of sources) {
      const fences = source.split('\n').filter((line) => /^\s*```/.test(line)).length;
      assert.equal(fences % 2, 0, `${slug} has an unclosed code fence`);
    }
  });
});
