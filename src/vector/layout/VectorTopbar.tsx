import React from 'react';
import { LoadingIndicator, TitlePortal, UserMenu } from 'react-admin';
import { Link } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { Menu } from 'lucide-react';
import ThemePreferenceToggle from '../../ui/ThemePreferenceToggle';
import { brand } from '../brand';
import { VxScope } from '../components/scope';
import { cn } from '../lib/utils';
import { RAIL_WIDTH, SIDEBAR_WIDTH, TOPBAR_HEIGHT, sidebarActions, useSidebar } from './sidebarStore';

const VectorTopbar: React.FC = () => {
  const mode = useTheme().palette.mode;
  const { collapsed } = useSidebar();
  const isMobile = useMediaQuery('(max-width:767px)');
  const rail = collapsed && !isMobile;

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
          <img
            src={rail || isMobile ? (mode === 'dark' ? brand.iconDark : brand.iconLight) : mode === 'dark' ? brand.logoDark : brand.logoLight}
            alt='Vector'
            className={cn('w-auto select-none', rail || isMobile ? 'h-7' : 'h-8')}
            draggable={false}
          />
        </Link>
      </div>

      <div className='flex min-w-0 flex-1 items-center justify-center px-5 [&_#react-admin-title]:text-center! [&_#react-admin-title]:text-[13px]! [&_#react-admin-title]:font-semibold! [&_#react-admin-title]:tracking-tight!'>
        <TitlePortal />
      </div>

      <div className='flex shrink-0 items-center gap-1 pr-3 text-muted-foreground [&_.MuiButtonBase-root]:text-inherit'>
        <LoadingIndicator sx={{ color: 'inherit' }} />
        <ThemePreferenceToggle />
        <UserMenu />
      </div>
    </VxScope>
  );
};

export default VectorTopbar;
