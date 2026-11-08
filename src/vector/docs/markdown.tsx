import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Copy, Info, Lightbulb, OctagonAlert } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * A small, dependency-free Markdown renderer for the docs.
 * It builds React elements (never raw HTML), so doc content cannot inject markup.
 *
 * Supported: headings, paragraphs, bold, italic, `code`, links (`doc:slug` links to another page),
 * fenced code blocks (with copy button), tables, ordered/unordered lists, blockquotes,
 * callouts (> [!NOTE] / [!TIP] / [!WARNING] / [!DANGER]) and horizontal rules.
 */

export interface Heading {
  id: string;
  level: number;
  text: string;
}

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/** Plain-text version of inline markdown (used for ids, the table of contents and search). */
export const stripInline = (text: string): string =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1');

/** Headings (h2 / h3) outside code fences, with unique ids. */
export const extractHeadings = (source: string): Heading[] => {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let fenced = false;
  for (const line of source.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = stripInline(match[2]);
    const base = slugify(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ id: count ? `${base}-${count}` : base, level: match[1].length, text });
  }
  return headings;
};

const inlineRe = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/g;
const linkClass = 'text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent';

const renderInline = (text: string, keyPrefix = 'i'): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(inlineRe)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className='border border-border bg-foreground/[0.05] px-1 py-px font-mono text-[0.85em] break-words'>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className='font-semibold text-foreground'>
          {renderInline(token.slice(2, -2), key)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        const [, label, href] = link;
        if (href.startsWith('doc:')) {
          const [slug, hash] = href.slice(4).split('#');
          nodes.push(
            <Link key={key} to={`/docs/${slug}${hash ? `#${hash}` : ''}`} className={linkClass}>
              {label}
            </Link>,
          );
        } else if (/^https?:\/\//.test(href)) {
          nodes.push(
            <a key={key} href={href} target='_blank' rel='noreferrer noopener' className={linkClass}>
              {label}
            </a>,
          );
        } else {
          nodes.push(label);
        }
      }
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

export const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (insecure origin): ignore */
    }
  };
  return (
    <div className='my-4 border border-border bg-foreground/[0.03]'>
      <div className='flex h-8 items-center justify-between border-b border-border px-3'>
        <span className='font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase'>{lang || 'text'}</span>
        <button
          type='button'
          onClick={() => void copy()}
          className='flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-accent'
          aria-label='Copy code'
        >
          {copied ? <Check className='size-3.5 text-accent' aria-hidden /> : <Copy className='size-3.5' aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className='overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-foreground'>
        <code>{code}</code>
      </pre>
    </div>
  );
};

const callouts = {
  NOTE: { icon: Info, label: 'Note', tone: 'border-accent/50 bg-accent/[0.06]', iconTone: 'text-accent' },
  TIP: { icon: Lightbulb, label: 'Tip', tone: 'border-emerald-500/50 bg-emerald-500/[0.06]', iconTone: 'text-emerald-500' },
  WARNING: { icon: AlertTriangle, label: 'Warning', tone: 'border-amber-500/60 bg-amber-500/[0.07]', iconTone: 'text-amber-500' },
  DANGER: { icon: OctagonAlert, label: 'Danger', tone: 'border-destructive/60 bg-destructive/[0.07]', iconTone: 'text-destructive' },
} as const;

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' };

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));

const listItemRe = /^\s*(?:([-*])|(\d+)\.)\s+(.*)$/;
const tableSeparatorRe = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export const parseBlocks = (source: string): Block[] => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^\s*```(\S*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[1], code: code.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && tableSeparatorRe.test(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', lines: quote });
      continue;
    }
    const listMatch = listItemRe.exec(line);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = listItemRe.exec(lines[i]);
        if (m && Boolean(m[2]) === ordered) {
          items.push(m[3]);
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length && !/^\s*```/.test(lines[i])) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        } else break;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !listItemRe.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }
  return blocks;
};

export const Markdown: React.FC<{ source: string }> = ({ source }) => {
  const blocks = React.useMemo(() => parseBlocks(source), [source]);
  const headings = React.useMemo(() => extractHeadings(source), [source]);
  let headingIndex = 0;

  return (
    <div className='text-[14px] leading-7 text-foreground/90'>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1 key={key} className='mb-3 text-[30px] leading-tight font-semibold tracking-tight text-foreground'>
                  {renderInline(block.text, key)}
                </h1>
              );
            }
            if (block.level === 2) {
              const id = headings[headingIndex++]?.id;
              return (
                <h2 key={key} id={id} className='mt-10 mb-3 scroll-mt-20 border-b border-border pb-2 text-[20px] font-semibold tracking-tight text-foreground'>
                  {renderInline(block.text, key)}
                </h2>
              );
            }
            if (block.level === 3) {
              const id = headings[headingIndex++]?.id;
              return (
                <h3 key={key} id={id} className='mt-7 mb-2 scroll-mt-20 text-[16px] font-semibold text-foreground'>
                  {renderInline(block.text, key)}
                </h3>
              );
            }
            return (
              <h4 key={key} className='mt-5 mb-2 text-[14px] font-semibold text-foreground'>
                {renderInline(block.text, key)}
              </h4>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className='my-3'>
                {renderInline(block.text, key)}
              </p>
            );
          case 'code':
            return <CodeBlock key={key} code={block.code} lang={block.lang} />;
          case 'hr':
            return <hr key={key} className='my-8 border-border' />;
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={key} className={cn('my-3 space-y-1.5 pl-6 marker:text-muted-foreground', block.ordered ? 'list-decimal' : 'list-disc')}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className='pl-1'>
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </List>
            );
          }
          case 'table':
            return (
              <div key={key} className='my-4 overflow-x-auto border border-border'>
                <table className='w-full border-collapse text-left text-[13px] leading-6'>
                  <thead className='bg-foreground/[0.04]'>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} className='border-b border-border px-3 py-2 font-semibold text-foreground'>
                          {renderInline(cell, `${key}-h${cellIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className='border-b border-border last:border-0'>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className='px-3 py-2 align-top'>
                            {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'quote': {
            const tag = /^\[!(NOTE|TIP|WARNING|DANGER)\]\s*$/.exec(block.lines[0] ?? '');
            const body = (tag ? block.lines.slice(1) : block.lines).join(' ').trim();
            const kind = tag ? callouts[tag[1] as keyof typeof callouts] : callouts.NOTE;
            const Icon = kind.icon;
            return (
              <div key={key} role='note' className={cn('my-4 flex gap-3 border-l-2 px-4 py-3', kind.tone)}>
                <Icon className={cn('mt-1 size-4 shrink-0', kind.iconTone)} aria-hidden />
                <div className='min-w-0'>
                  {tag && <p className='text-[12px] font-semibold tracking-wide text-foreground uppercase'>{kind.label}</p>}
                  <p>{renderInline(body, key)}</p>
                </div>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
};
