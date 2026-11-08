import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Authenticated } from 'react-admin';
import { useTheme } from '@mui/material';
import ThemePreferenceToggle from '../../ui/ThemePreferenceToggle';
import { brand } from '../brand';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Search, X } from 'lucide-react';
import { VxScope } from '../components/scope';
import { docSections, docs, findDoc, searchDocs, type DocPage } from '../docs/registry';
import { Markdown } from '../docs/markdown';
import { cn } from '../lib/utils';

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

const SearchBox: React.FC<{ query: string; onChange: (value: string) => void; autoFocus?: boolean }> = ({ query, onChange, autoFocus }) => (
  <label className='flex h-9 items-center gap-2 border border-input bg-foreground/[0.03] px-3 text-[13px] focus-within:border-accent'>
    <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden />
    <input
      type='text'
      value={query}
      onChange={(event) => onChange(event.target.value)}
      placeholder='Search the docs…'
      aria-label='Search the docs'
      autoFocus={autoFocus}
      className='min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground'
    />
    {query && (
      <button type='button' onClick={() => onChange('')} aria-label='Clear search' className='text-muted-foreground hover:text-foreground'>
        <X className='size-4' aria-hidden />
      </button>
    )}
  </label>
);

const SearchResults: React.FC<{ query: string; onPick: () => void }> = ({ query, onPick }) => {
  const hits = useMemo(() => searchDocs(query), [query]);
  if (!query.trim()) return null;
  return (
    <div className='border border-border bg-card'>
      {hits.length === 0 ? (
        <p className='px-4 py-6 text-center text-[13px] text-muted-foreground'>No pages match “{query}”.</p>
      ) : (
        <ul>
          {hits.map(({ doc, snippet }) => (
            <li key={doc.slug} className='border-b border-border last:border-0'>
              <Link to={`/docs/${doc.slug}`} onClick={onPick} className='block px-4 py-3 outline-none hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06]'>
                <p className='text-[13px] font-semibold text-foreground'>
                  {doc.title} <span className={cn(microLabel, 'ml-2')}>{doc.section}</span>
                </p>
                <p className='mt-0.5 text-[12px] leading-relaxed text-muted-foreground'>{snippet}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const DocNav: React.FC<{ current?: string }> = ({ current }) => (
  <nav aria-label='Documentation' className='grid gap-5'>
    {docSections.map((section) => (
      <div key={section}>
        <p className={cn(microLabel, 'mb-1.5 px-3')}>{section}</p>
        <ul>
          {docs
            .filter((doc) => doc.section === section)
            .map((doc) => (
              <li key={doc.slug}>
                <Link
                  to={`/docs/${doc.slug}`}
                  aria-current={doc.slug === current ? 'page' : undefined}
                  className={cn(
                    'block border-l-2 px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:bg-foreground/[0.06]',
                    doc.slug === current
                      ? 'border-accent bg-foreground/[0.05] font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                  )}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
        </ul>
      </div>
    ))}
  </nav>
);

const OnThisPage: React.FC<{ doc: DocPage; activeId?: string }> = ({ doc, activeId }) => {
  if (doc.headings.length === 0) return null;
  return (
    <nav aria-label='On this page' className='text-[12px]'>
      <p className={cn(microLabel, 'mb-2')}>On this page</p>
      <ul className='border-l border-border'>
        {doc.headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.history.replaceState(null, '', `#/docs/${doc.slug}`);
              }}
              className={cn(
                '-ml-px block border-l py-1 leading-snug transition-colors',
                heading.level === 3 ? 'pl-6' : 'pl-3',
                heading.id === activeId ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const Landing: React.FC = () => {
  const [query, setQuery] = useState('');
  return (
    <div className='mx-auto w-full max-w-[980px]'>
      <div className='mb-8 text-center'>
        <BookOpen className='mx-auto mb-3 size-8 text-accent' aria-hidden />
        <h1 className='text-[32px] font-semibold tracking-tight text-foreground'>Vector documentation</h1>
        <p className='mx-auto mt-2 max-w-[560px] text-[14px] text-muted-foreground'>
          Everything you need to run the server, deploy software from your computer, bring devices online and fix problems.
        </p>
      </div>
      <div className='mx-auto mb-8 max-w-[560px]'>
        <SearchBox query={query} onChange={setQuery} />
        {query.trim() && (
          <div className='mt-2'>
            <SearchResults query={query} onPick={() => setQuery('')} />
          </div>
        )}
      </div>
      {!query.trim() && (
        <div className='grid gap-6 md:grid-cols-2'>
          {docSections.map((section) => (
            <section key={section} className='border border-border bg-card p-5'>
              <h2 className={cn(microLabel, 'mb-3')}>{section}</h2>
              <ul className='grid gap-3'>
                {docs
                  .filter((doc) => doc.section === section)
                  .map((doc) => (
                    <li key={doc.slug}>
                      <Link to={`/docs/${doc.slug}`} className='group block outline-none'>
                        <p className='text-[14px] font-medium text-foreground group-hover:text-accent group-focus-visible:text-accent'>{doc.title}</p>
                        <p className='text-[12.5px] leading-snug text-muted-foreground'>{doc.description}</p>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const Article: React.FC<{ doc: DocPage }> = ({ doc }) => {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>();
  const articleRef = useRef<HTMLElement>(null);

  const index = docs.findIndex((candidate) => candidate.slug === doc.slug);
  const previous = docs[index - 1];
  const next = docs[index + 1];

  // jump to the #hash, or to the top when the page changes
  useEffect(() => {
    setNavOpen(false);
    setQuery('');
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    // the router hash may itself look like "/docs/slug"; only use a plain section id
    const target = hash && !hash.includes('/') ? document.getElementById(hash) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [doc.slug, location.hash]);

  // highlight the section being read
  useEffect(() => {
    const headings = doc.headings.map((heading) => document.getElementById(heading.id)).filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [doc]);

  return (
    <div className='mx-auto grid w-full max-w-[1500px] gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]'>
      {/* left: search + page list (a collapsible menu on small screens) */}
      <aside className='lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto'>
        <div className='mb-4'>
          <SearchBox query={query} onChange={setQuery} />
        </div>
        {query.trim() ? (
          <SearchResults query={query} onPick={() => setQuery('')} />
        ) : (
          <>
            <button
              type='button'
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              className='flex w-full items-center justify-between border border-border px-3 py-2 text-[13px] lg:hidden'
            >
              <span>
                <span className={cn(microLabel, 'mr-2')}>{doc.section}</span>
                {doc.title}
              </span>
              <ChevronDown className={cn('size-4 transition-transform', navOpen && 'rotate-180')} aria-hidden />
            </button>
            <div className={cn('mt-3 lg:mt-0 lg:block', navOpen ? 'block' : 'hidden')}>
              <DocNav current={doc.slug} />
            </div>
          </>
        )}
      </aside>

      <article ref={articleRef} className='min-w-0 pb-10'>
        <p className={cn(microLabel, 'mb-3')}>
          <Link to='/docs' className='hover:text-foreground'>
            Docs
          </Link>
          {' / '}
          {doc.section}
        </p>
        <Markdown source={doc.source} />

        <div className='mt-12 grid gap-3 border-t border-border pt-6 sm:grid-cols-2'>
          {previous ? (
            <Link to={`/docs/${previous.slug}`} className='group flex flex-col border border-border px-4 py-3 outline-none hover:border-accent focus-visible:border-accent'>
              <span className={cn(microLabel, 'flex items-center gap-1.5')}>
                <ArrowLeft className='size-3' aria-hidden /> Previous
              </span>
              <span className='mt-1 text-[14px] font-medium text-foreground group-hover:text-accent'>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/docs/${next.slug}`} className='group flex flex-col items-end border border-border px-4 py-3 text-right outline-none hover:border-accent focus-visible:border-accent'>
              <span className={cn(microLabel, 'flex items-center gap-1.5')}>
                Next <ArrowRight className='size-3' aria-hidden />
              </span>
              <span className='mt-1 text-[14px] font-medium text-foreground group-hover:text-accent'>{next.title}</span>
            </Link>
          )}
        </div>
      </article>

      <aside className='hidden xl:sticky xl:top-20 xl:block xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto'>
        <OnThisPage doc={doc} activeId={activeId} />
      </aside>
    </div>
  );
};

const Header: React.FC = () => {
  const mode = useTheme().palette.mode;
  return (
    <header className='sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background px-4 sm:px-6'>
      <Link to='/docs' aria-label='Documentation home' className='flex items-center gap-3 outline-none'>
        <img
          src={mode === 'dark' ? brand.wordmarkDark : brand.wordmarkLight}
          alt='Vector'
          className='hidden h-[18px] w-auto select-none sm:block'
          draggable={false}
        />
        <span className={cn(microLabel, 'sm:border-l sm:border-border sm:pl-3')}>Docs</span>
      </Link>
      <Link
        to='/'
        aria-label='Back to dashboard'
        title='Back to dashboard'
        className='flex size-9 items-center justify-center border border-input text-foreground transition-colors outline-none hover:border-accent hover:text-accent focus-visible:border-accent'
      >
        <ArrowLeft className='size-4' aria-hidden />
      </Link>
      <div className='ml-auto flex items-center text-muted-foreground [&_.MuiButtonBase-root]:text-inherit'>
        <ThemePreferenceToggle />
      </div>
    </header>
  );
};

const Docs: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const doc = findDoc(slug);

  useEffect(() => {
    document.title = doc ? `${doc.title} · Vector Docs` : 'Vector Docs';
  }, [doc]);

  return (
    <Authenticated requireAuth>
      <VxScope className='min-h-screen w-full bg-background text-foreground'>
        <Header />
        <main className='px-4 py-8 sm:px-6'>
          {slug && !doc ? <Navigate to='/docs' replace /> : doc ? <Article doc={doc} /> : <Landing />}
        </main>
      </VxScope>
    </Authenticated>
  );
};

export default Docs;
