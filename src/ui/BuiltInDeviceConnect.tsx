import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import TerminalIcon from '@mui/icons-material/Terminal';
import { Alert, Box, GlobalStyles, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { useAuthProvider } from 'react-admin';
import type { OpenBalenaAuthProvider } from '../authProvider/openbalenaAuthProvider';
import type { ResourceRecord } from '../types/resource';
import { RemoteTerminalTab, type TerminalStatus, type TerminalTarget } from './RemoteTerminalTab';
import { RemoteFileTransfer } from './RemoteFileTransfer';
import { deviceServiceTerminalTargets, getServiceColors } from '../lib/deviceServicePresentation';
import { useDeviceServicePresentation } from './useDeviceServicePresentation';
import { ServiceBadge } from './ServiceBadge';

interface BuiltInDeviceConnectProps {
  record: ResourceRecord;
}
interface SessionTab {
  id: number;
  status: TerminalStatus;
  label: string;
}

const Session: React.FC<{
  tab: SessionTab;
  active: boolean;
  expanded: boolean;
  token: string;
  deviceUuid: string;
  targets: TerminalTarget[];
  update: (id: number, status: TerminalStatus, label: string) => void;
}> = ({ tab, update, ...props }) => {
  const onStatus = React.useCallback(
    (status: TerminalStatus, label: string) => update(tab.id, status, label),
    [tab.id, update],
  );
  return <RemoteTerminalTab {...props} onStatus={onStatus} />;
};

export const BuiltInDeviceConnect: React.FC<BuiltInDeviceConnectProps> = ({ record }) => {
  const authProvider = useAuthProvider<OpenBalenaAuthProvider>();
  const presentation = useDeviceServicePresentation(record);
  const targets = deviceServiceTerminalTargets(presentation.services);
  const [tabs, setTabs] = React.useState<SessionTab[]>([{ id: 1, status: 'disconnected', label: 'Host OS' }]);
  const [active, setActive] = React.useState(1);
  const nextId = React.useRef(2);
  const [expanded, setExpanded] = React.useState(false);
  const activeStatus = tabs.find((tab) => tab.id === active)?.status ?? 'disconnected';
  const token = authProvider?.getSession().jwt ?? '';
  const deviceUuid = typeof record.uuid === 'string' ? record.uuid : '';

  React.useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', escape);
    };
  }, [expanded]);
  const update = React.useCallback((id: number, status: TerminalStatus, label: string) => {
    setTabs((current) =>
      current.map((tab) =>
        tab.id === id && (tab.status !== status || tab.label !== label) ? { ...tab, status, label } : tab,
      ),
    );
  }, []);
  const close = (id: number) => {
    const remaining = tabs.filter((tab) => tab.id !== id);
    if (!remaining.length) {
      const fresh = nextId.current++;
      setTabs([{ id: fresh, status: 'disconnected', label: 'Host OS' }]);
      setActive(fresh);
    } else {
      setTabs(remaining);
      if (active === id) setActive(remaining[remaining.length - 1].id);
    }
  };
  return (
    <Box
      data-remote-expanded={expanded}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0b0f14',
        color: '#dbe4ee',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: 0,
        ...(expanded ? { position: 'fixed', inset: 0, zIndex: 1400, height: '100dvh' } : { minHeight: 490 }),
      }}
    >
      <GlobalStyles
        styles={{
          // React Admin's content is a stacking context below its app bar.
          '.RaLayout-content.RaLayout-content:has([data-remote-expanded="true"])': { zIndex: 1400 },
        }}
      />
      <Stack
        direction='row'
        alignItems='center'
        spacing={1.25}
        sx={{ px: 2, py: 1.25, bgcolor: '#0e131a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <TerminalIcon fontSize='small' sx={{ color: '#22d3ee' }} />
        <Typography variant='subtitle2' sx={{ flex: 1, color: '#dbe4ee', fontWeight: 600 }}>
          Terminal · {String(record['device name'] ?? 'Unnamed device')}
        </Typography>
        <Box
          component='span'
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.25,
            borderRadius: 99,
            fontSize: 11.5,
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.12)',
            color: activeStatus === 'connected' ? '#68d391' : activeStatus === 'connecting' ? '#f6c45b' : '#8da0b3',
          }}
        >
          <Box
            component='span'
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: 'currentColor',
              boxShadow: activeStatus === 'connected' ? '0 0 8px currentColor' : 'none',
            }}
          />
          {activeStatus === 'connected' ? 'Connected' : activeStatus === 'connecting' ? 'Connecting' : 'Not connected'}
        </Box>
        <Tooltip title={expanded ? 'Collapse terminal' : 'Expand terminal'}>
          <IconButton
            size='small'
            aria-label={expanded ? 'Collapse terminal' : 'Expand terminal'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <CloseFullscreenIcon fontSize='small' /> : <OpenInFullIcon fontSize='small' />}
          </IconButton>
        </Tooltip>
      </Stack>
      {presentation.error ? (
        <Alert severity='error'>Unable to load terminal targets: {presentation.error.message}</Alert>
      ) : null}
      {presentation.isPending && <LinearProgress aria-label='Loading terminal targets' />}
      <Stack direction='row' alignItems='center' sx={{ bgcolor: '#0e131a', px: 1, py: 0.75, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box role='tablist' aria-label='Terminal sessions' sx={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
          {tabs.map((tab, index) => {
            const color = getServiceColors(tab.label).backgroundColor;
            return (
              <Box
                key={tab.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mr: 0.5,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: active === tab.id ? 'rgba(255,255,255,0.14)' : 'transparent',
                  bgcolor: active === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <Box
                  component='button'
                  role='tab'
                  aria-selected={active === tab.id}
                  aria-controls={`terminal-panel-${tab.id}`}
                  id={`terminal-tab-${tab.id}`}
                  onClick={() => setActive(tab.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    border: 0,
                    bgcolor: 'transparent',
                    color,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 13,
                  }}
                >
                  <Box
                    component='span'
                    title={tab.status}
                    aria-label={tab.status}
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor:
                        tab.status === 'connected' ? '#68d391' : tab.status === 'connecting' ? '#f6c45b' : '#718096',
                    }}
                  />
                  <ServiceBadge name={tab.label} /> · {index + 1}
                </Box>
                <IconButton
                  size='small'
                  aria-label={`Close terminal ${index + 1}`}
                  onClick={() => close(tab.id)}
                  sx={{ color: '#a8b6c5', mr: 0.5 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
        <Tooltip title='Add terminal'>
          <IconButton
            size='small'
            aria-label='Add terminal'
            sx={{ color: '#a8b6c5' }}
            onClick={() => {
              const id = nextId.current++;
              setTabs((current) => [...current, { id, status: 'disconnected', label: 'Host OS' }]);
              setActive(id);
            }}
          >
            <AddIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ display: 'flex', flex: 1, minHeight: expanded ? 0 : 300 }}>
        {tabs.map((tab) => (
          <Box
            key={tab.id}
            role='tabpanel'
            id={`terminal-panel-${tab.id}`}
            aria-labelledby={`terminal-tab-${tab.id}`}
            hidden={active !== tab.id}
            sx={{ display: active === tab.id ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <Session
              tab={tab}
              active={active === tab.id}
              expanded={expanded}
              token={token}
              deviceUuid={deviceUuid}
              targets={targets}
              update={update}
            />
          </Box>
        ))}
      </Box>
      <RemoteFileTransfer token={token} deviceUuid={deviceUuid} targets={targets} />
    </Box>
  );
};
export default BuiltInDeviceConnect;
