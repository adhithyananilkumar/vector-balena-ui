import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDataProvider } from 'react-admin';
import { useNavigate } from 'react-router-dom';
import { Boxes, Cpu, LayoutDashboard, Search, type LucideIcon } from 'lucide-react';
import { VxScope } from '../components/scope';
import { cn } from '../lib/utils';
import { useNavGroups } from './navModel';

type Section = 'Pages' | 'Devices' | 'Fleets';
interface Result {
  key: string;
  section: Section;
  label: string;
  hint?: string;
  icon: LucideIcon;
  to: string;
}

const kbd = 'border border-border px-1.5 py-px font-mono text-[10px] text-muted-foreground';

const DEVICE_FILTER = '#uuid,device name,status@ilike';
const FLEET_FILTER = '#app name@ilike';

/** Jump-to-anything search: pages from the sidebar plus live device and fleet lookups. */
export const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const dataProvider = useDataProvider();
  const groups = useNavGroups();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<{ devices: Result[]; fleets: Result[] }>({ devices: [], fleets: [] });
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // reset every time it opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setRemote({ devices: [], fleets: [] });
    }
  }, [open]);

  const pages = useMemo<Result[]>(() => {
    const items: Result[] = [{ key: 'page:overview', section: 'Pages', label: 'Overview', hint: 'Home', icon: LayoutDashboard, to: '/' }];
    groups.forEach((group) =>
      group.children.forEach((child) =>
        items.push({
          key: `page:${child.name}`,
          section: 'Pages',
          label: child.label,
          hint: group.label,
          icon: child.icon,
          to: `/${encodeURIComponent(child.name)}`,
        }),
      ),
    );
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle)) : items;
  }, [groups, query]);

  // live device / fleet lookup, debounced
  useEffect(() => {
    const needle = query.trim();
    if (!open || needle.length < 2) {
      setRemote({ devices: [], fleets: [] });
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const options: any = { pagination: { page: 1, perPage: 5 }, sort: { field: 'id', order: 'DESC' } };
      const [devices, fleets] = await Promise.all([
        dataProvider.getList('device', { ...options, filter: { [DEVICE_FILTER]: needle } }).catch(() => null),
        dataProvider.getList('application', { ...options, filter: { [FLEET_FILTER]: needle } }).catch(() => null),
      ]);
      if (cancelled) return;
      setRemote({
        devices: (devices?.data ?? []).map((device: Record<string, any>) => ({
          key: `device:${device.id}`,
          section: 'Devices' as const,
          label: String(device['device name'] ?? device.uuid ?? device.id),
          hint: String(device.uuid ?? '').slice(0, 8),
          icon: Cpu,
          to: `/device/${device.id}/show`,
        })),
        fleets: (fleets?.data ?? [])
          .filter((fleet: Record<string, any>) => !fleet['is host'])
          .map((fleet: Record<string, any>) => ({
            key: `fleet:${fleet.id}`,
            section: 'Fleets' as const,
            label: String(fleet['app name'] ?? fleet.id),
            hint: 'Fleet',
            icon: Boxes,
            to: `/application/${fleet.id}/show`,
          })),
      });
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, dataProvider]);

  const results = useMemo(() => [...remote.devices, ...remote.fleets, ...pages], [remote, pages]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = (result: Result | undefined) => {
    if (!result) return;
    onClose();
    navigate(result.to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let lastSection: Section | null = null;

  return createPortal(
    <VxScope className='fixed inset-0 z-[1400] flex items-start justify-center px-4 pt-[12vh]'>
      <div className='absolute inset-0 animate-fade-in bg-black/65' onClick={onClose} aria-hidden />
      <div
        role='dialog'
        aria-modal='true'
        aria-label='Search'
        className='relative flex max-h-[70vh] w-[min(640px,100%)] animate-pop-in flex-col border border-border bg-card text-card-foreground shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)]'
      >
        <div className='flex items-center gap-3 border-b border-border px-4'>
          <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder='Search pages, devices and fleets…'
            role='combobox'
            aria-expanded='true'
            aria-controls='vx-search-results'
            aria-activedescendant={results[active] ? `vx-result-${active}` : undefined}
            className='h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70'
          />
          <kbd className={kbd}>Esc</kbd>
        </div>

        <div ref={listRef} id='vx-search-results' role='listbox' className='min-h-0 flex-1 overflow-y-auto py-1.5'>
          {results.map((result, index) => {
            const header = result.section !== lastSection ? result.section : null;
            lastSection = result.section;
            const Icon = result.icon;
            const isActive = index === active;
            return (
              <React.Fragment key={result.key}>
                {header && (
                  <p className='px-4 pt-3 pb-1.5 font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase'>
                    {header}
                  </p>
                )}
                <button
                  type='button'
                  id={`vx-result-${index}`}
                  role='option'
                  aria-selected={isActive}
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(result)}
                  className={cn(
                    'relative flex h-10 w-full items-center gap-3 px-4 text-left text-[13px] outline-none',
                    isActive ? 'bg-foreground/[0.07] text-foreground' : 'text-foreground/85',
                  )}
                >
                  {isActive && <span className='absolute inset-y-0 left-0 w-0.5 bg-accent' />}
                  <Icon className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-muted-foreground')} aria-hidden />
                  <span className='min-w-0 flex-1 truncate'>{result.label}</span>
                  {result.hint && <span className='shrink-0 font-mono text-[11px] text-muted-foreground'>{result.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
          {results.length === 0 && !searching && (
            <p className='px-4 py-10 text-center text-[13px] text-muted-foreground'>No results for “{query.trim()}”.</p>
          )}
          {searching && results.length === 0 && <p className='px-4 py-10 text-center text-[13px] text-muted-foreground'>Searching…</p>}
        </div>

        <div className='flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <kbd className={kbd}>↑</kbd>
            <kbd className={kbd}>↓</kbd> navigate
          </span>
          <span className='flex items-center gap-1.5'>
            <kbd className={kbd}>↵</kbd> open
          </span>
          {searching && <span className='ml-auto font-mono'>searching…</span>}
        </div>
      </div>
    </VxScope>,
    document.body,
  );
};
