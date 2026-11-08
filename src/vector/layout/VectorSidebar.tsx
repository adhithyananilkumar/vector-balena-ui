import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, useMediaQuery } from '@mui/material';
import { ChevronDown, ChevronsLeft, ChevronsRight, LayoutDashboard } from 'lucide-react';
import { VxScope } from '../components/scope';
import { cn } from '../lib/utils';
import { useNavGroups } from './navModel';
import { RAIL_WIDTH, SIDEBAR_WIDTH, TOPBAR_HEIGHT, sidebarActions, useSidebar } from './sidebarStore';

const isActivePath = (pathname: string, name: string): boolean => {
  const base = `/${name}`;
  return pathname === base || pathname.startsWith(`${base}/`);
};

const NavTooltip: React.FC<{ title: string; show: boolean; children: React.ReactElement }> = ({ title, show, children }) =>
  show ? (
    <Tooltip title={title} placement='right' enterDelay={150}>
      {children}
    </Tooltip>
  ) : (
    children
  );

const itemBase =
  'relative flex h-9 w-full items-center gap-3 px-[22px] text-[13px] outline-none transition-colors focus-visible:bg-foreground/[0.06]';
const itemIdle = 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground';
const itemActive = 'bg-foreground/[0.06] font-medium text-foreground';

const VectorSidebar: React.FC = () => {
  const { collapsed, groups, mobileOpen } = useSidebar();
  const isMobile = useMediaQuery('(max-width:767px)');
  const showLabels = !collapsed || isMobile;
  const location = useLocation();
  const pathname = useMemo(() => {
    try {
      return decodeURIComponent(location.pathname);
    } catch {
      return location.pathname;
    }
  }, [location.pathname]);

  const navGroups = useNavGroups();

  // close the mobile drawer when navigating
  useEffect(() => {
    sidebarActions.closeMobile();
  }, [pathname]);

  // Ctrl/Cmd + B toggles the sidebar
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (isMobile) sidebarActions.toggleMobile();
        else sidebarActions.toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);


  return (
    <>
      {mobileOpen && (
        <button
          type='button'
          aria-label='Close navigation'
          className='fixed inset-0 z-[1180] bg-black/60 md:hidden'
          onClick={sidebarActions.closeMobile}
        />
      )}
      <VxScope
        role='navigation'
        aria-label='Main'
        style={{
          ['--vx-w' as string]: `${collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH}px`,
          top: TOPBAR_HEIGHT,
          height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
        }}
        className={cn(
          'z-[1190] flex shrink-0 flex-col border-r border-border bg-background transition-[width,transform] duration-200 ease-out',
          'fixed left-0 w-[248px] md:sticky md:w-[var(--vx-w)]',
          mobileOpen ? 'translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        <div className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3'>
          {/* overview */}
          <NavTooltip title='Overview' show={!showLabels}>
            <Link to='/' className={cn(itemBase, pathname === '/' ? itemActive : itemIdle)} aria-current={pathname === '/' ? 'page' : undefined}>
              {pathname === '/' && <span className='absolute inset-y-0 left-0 w-0.5 bg-accent' />}
              <LayoutDashboard className='size-4 shrink-0' aria-hidden />
              {showLabels && <span className='truncate'>Overview</span>}
            </Link>
          </NavTooltip>

          {showLabels && (
            <p className='mt-5 mb-1.5 px-[22px] text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/60 uppercase'>
              Manage
            </p>
          )}
          {!showLabels && <div className='mx-4 my-3 border-t border-border' />}

          {navGroups.map((group) => {
            const Icon = group.icon;
            const hasActiveChild = group.children.some((child) => isActivePath(pathname, child.name));
            const open = groups[group.name] ?? hasActiveChild;

            if (!showLabels) {
              return (
                <NavTooltip key={group.name} title={group.label} show>
                  <button
                    type='button'
                    className={cn(itemBase, hasActiveChild ? itemActive : itemIdle)}
                    onClick={() => {
                      sidebarActions.setCollapsed(false);
                      sidebarActions.setGroup(group.name, true);
                    }}
                    aria-label={`${group.label}, expand navigation`}
                  >
                    {hasActiveChild && <span className='absolute inset-y-0 left-0 w-0.5 bg-accent' />}
                    <Icon className='size-4 shrink-0' aria-hidden />
                  </button>
                </NavTooltip>
              );
            }

            return (
              <div key={group.name}>
                <button
                  type='button'
                  className={cn(itemBase, hasActiveChild && !open ? itemActive : itemIdle, 'justify-between')}
                  onClick={() => sidebarActions.setGroup(group.name, !open)}
                  aria-expanded={open}
                >
                  <span className='flex min-w-0 items-center gap-3'>
                    <Icon className='size-4 shrink-0' aria-hidden />
                    <span className='truncate'>{group.label}</span>
                  </span>
                  <ChevronDown className={cn('size-3.5 shrink-0 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')} aria-hidden />
                </button>
                {open && (
                  <div className='relative mb-1 ml-[29px] border-l border-border'>
                    {group.children.map((child) => {
                      const active = isActivePath(pathname, child.name);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.name}
                          to={`/${encodeURIComponent(child.name)}`}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'relative flex h-8 items-center gap-2.5 pr-3 pl-4 text-[13px] outline-none transition-colors focus-visible:bg-foreground/[0.06]',
                            active ? 'bg-foreground/[0.06] font-medium text-foreground' : itemIdle,
                          )}
                        >
                          {active && <span className='absolute inset-y-0 -left-px w-0.5 bg-accent' />}
                          <ChildIcon className={cn('size-3.5 shrink-0', active && 'text-accent')} aria-hidden />
                          <span className='truncate'>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* collapse / expand pill, sitting on the sidebar's right border near the bottom */}
        <button
          type='button'
          onClick={sidebarActions.toggleCollapsed}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className='absolute -right-3.5 bottom-7 z-10 hidden h-7 w-7 place-items-center rounded-full border border-border bg-background text-foreground/80 transition-colors outline-none hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent md:grid'
        >
          {collapsed ? <ChevronsRight className='size-4' strokeWidth={2.4} aria-hidden /> : <ChevronsLeft className='size-4' strokeWidth={2.4} aria-hidden />}
        </button>
      </VxScope>
    </>
  );
};

export default VectorSidebar;
