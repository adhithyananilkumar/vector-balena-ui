import React, { useEffect, useState } from 'react';
import { LoadingIndicator, TitlePortal, UserMenu } from 'react-admin';
import { Link, useLocation } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { BookOpen, Info, Menu, Search } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import ThemePreferenceToggle from '../../ui/ThemePreferenceToggle';
import { brand } from '../brand';
import { VxScope } from '../components/scope';
import { cn } from '../lib/utils';
import { pageHelpFor } from './pageHelp';
import { RAIL_WIDTH, SIDEBAR_WIDTH, TOPBAR_HEIGHT, sidebarActions, useSidebar } from './sidebarStore';

/** (i) next to the page title: opens a short explanation of the current page. */
const PageInfo: React.FC = () => {
  const { pathname } = useLocation();
  const help = pageHelpFor(pathname);
  const [open, setOpen] = useState(false);
  const root = React.useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!help) return null;
  return (
    <div ref={root} className='pointer-events-auto relative'>
      <button
        type='button'
        aria-label='About this page'
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className='grid size-7 place-items-center text-muted-foreground transition-colors outline-none hover:text-accent focus-visible:text-accent'
      >
        <Info className='size-4' aria-hidden />
      </button>
      {open && (
        <div
          role='dialog'
          aria-label='About this page'
          className='absolute top-full left-1/2 z-10 mt-2 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in border border-border bg-card p-4 text-left text-card-foreground shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]'
        >
          <p className='text-[13px] font-semibold'>{help.summary}</p>
          {help.details?.map((paragraph) => (
            <p key={paragraph} className='mt-2 text-[13px] leading-relaxed font-normal text-muted-foreground'>
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const VectorTopbar: React.FC = () => {
  const mode = useTheme().palette.mode;
  const { collapsed } = useSidebar();
  const isMobile = useMediaQuery('(max-width:767px)');
  const rail = collapsed && !isMobile;
  const [searchOpen, setSearchOpen] = useState(false);
  const onDocs = useLocation().pathname.startsWith('/docs');
  const shortcut = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  // Ctrl/Cmd + K opens search from anywhere
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <VxScope
      role='banner'
      style={{ height: TOPBAR_HEIGHT }}
      className='fixed inset-x-0 top-0 z-[1200] flex items-stretch border-b border-border bg-background text-foreground'
    >
      <div
        className={cn('flex shrink-0 items-center border-r border-border transition-[width] duration-200 ease-out', rail ? 'justify-center' : 'gap-3 px-4')}
        style={{ width: isMobile ? 'auto' : rail ? RAIL_WIDTH : SIDEBAR_WIDTH }}
      >
        <button
          type='button'
          className='grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground md:hidden'
          onClick={sidebarActions.toggleMobile}
          aria-label='Toggle navigation'
        >
          <Menu className='size-5' aria-hidden />
        </button>
        <Link to='/' aria-label='Vector overview' className='flex items-center outline-none'>
          {/* expanded: the VECTOR wordmark on its own; collapsed / mobile: the diamond mark */}
          <img
            src={
              rail || isMobile
                ? mode === 'dark'
                  ? brand.iconDark
                  : brand.iconLight
                : mode === 'dark'
                  ? brand.wordmarkDark
                  : brand.wordmarkLight
            }
            alt='Vector'
            className={cn('w-auto select-none', rail || isMobile ? 'h-7' : 'h-[21px]')}
            draggable={false}
          />
        </Link>
      </div>

      {/* search */}
      <div className='hidden items-center pl-4 md:flex'>
        <button
          type='button'
          onClick={() => setSearchOpen(true)}
          aria-label='Search'
          className='flex h-9 w-9 items-center justify-center gap-2.5 border border-input bg-foreground/[0.03] text-[13px] text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:text-foreground focus-visible:border-accent lg:w-[300px] lg:justify-start lg:px-3'
        >
          <Search className='size-4 shrink-0' aria-hidden />
          <span className='hidden flex-1 text-left lg:block'>Search…</span>
          <kbd className='hidden border border-border px-1.5 py-px font-mono text-[10px] text-muted-foreground lg:inline'>{shortcut}</kbd>
        </button>
      </div>

      {/* page title: centered over the content area (right of the sidebar), not the whole screen */}
      <div
        style={{ ['--vx-title-left' as string]: `${rail ? RAIL_WIDTH : SIDEBAR_WIDTH}px` }}
        className='pointer-events-none flex min-w-0 items-center justify-center px-5 transition-[left] duration-200 ease-out max-lg:flex-1 lg:absolute lg:inset-y-0 lg:right-0 lg:left-[var(--vx-title-left)] [&_#react-admin-title]:flex-none! [&_#react-admin-title]:text-center! [&_#react-admin-title]:text-[13px]! [&_#react-admin-title]:font-semibold! [&_#react-admin-title]:tracking-tight! [&_#react-admin-title>:not(:last-child)]:hidden!'>
        <TitlePortal />
        <PageInfo />
      </div>

      <div className='ml-auto flex shrink-0 items-center gap-1 pr-3 text-muted-foreground [&_.MuiButtonBase-root]:text-inherit'>
        <button
          type='button'
          onClick={() => setSearchOpen(true)}
          aria-label='Search'
          className='grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground md:hidden'
        >
          <Search className='size-[18px]' aria-hidden />
        </button>
        <LoadingIndicator sx={{ color: 'inherit' }} />
        <Link
          to='/docs'
          aria-label='Documentation'
          title='Documentation'
          className={cn(
            'flex h-9 items-center gap-2 border px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:border-accent sm:px-3',
            onDocs ? 'border-accent text-accent' : 'border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground',
          )}
        >
          <BookOpen className='size-4' aria-hidden />
          <span className='hidden sm:inline'>Docs</span>
        </Link>
        <ThemePreferenceToggle />
        <UserMenu />
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </VxScope>
  );
};

export default VectorTopbar;
