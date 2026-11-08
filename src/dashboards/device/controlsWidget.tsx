import React from 'react';
import LightModeIcon from '@mui/icons-material/LightMode';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Box, Button, Typography, styled } from '@mui/material';
import { BrandMark } from '../../vector/components/brands';
import { FunctionField, ReferenceField, TextField, useAuthProvider, useNotify, useRecordContext } from 'react-admin';
import { OnlineField } from '../../components/device';
import { useReconcileDeviceServices } from '../../lib/device';
import environment from '../../lib/reactAppEnv';
import utf8decode from '../../lib/utf8decode';
import { ConfirmationDialog, type ConfirmationDialogProps } from '../../ui/ConfirmationDialog';
import type { RaRecord } from 'react-admin';
import { deviceOnlineStatusField, isDeviceOnline } from '../../lib/deviceStatus';
import { DeviceFieldEditor, loadFleetChoices } from '../../ui/DeviceFieldEditor';
import { HeartbeatStatusIcon, VpnStatusIcon } from '../../ui/DeviceConnectivityStatusIcon';
import versions from '../../versions';

const isPinnedOnRelease = versions.resource('isPinnedOnRelease', environment.REACT_APP_OPEN_BALENA_API_VERSION);

const StatLabel = styled('div')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  minHeight: 22,
  marginBottom: 2,
}));

type DeviceRecord = RaRecord & {
  'uuid': string;
  'device name': string;
  'api heartbeat state'?: string;
  'is connected to vpn'?: boolean;
  'last connectivity event'?: string;
  'changed api heartbeat state on-date'?: string;
  'note'?: string;
};

const ControlsWidget: React.FC = () => {
  const authProvider = useAuthProvider();
  const notify = useNotify();
  const record = useRecordContext<DeviceRecord>();
  const reconcileDeviceServices = useReconcileDeviceServices();

  const [confirmationDialog, setConfirmationDialog] = React.useState<ConfirmationDialogProps | null>(null);

  const invokeSupervisor = React.useCallback(
    async (device: DeviceRecord, command: string) => {
      const session = authProvider?.getSession?.();
      if (!session?.jwt) {
        notify('Error: Unable to execute command without a valid session', { type: 'error' });
        return;
      }

      try {
        const response = await fetch(`${environment.REACT_APP_OPEN_BALENA_API_URL}/supervisor/v1/${command}`, {
          method: 'POST',
          body: JSON.stringify({ uuid: device.uuid }),
          headers: new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.jwt}`,
          }),
          insecureHTTPParser: true,
        });

        if (response.status < 200 || response.status >= 300) {
          throw new Error(response.statusText);
        }

        const body = response.body;
        if (!body) {
          return;
        }

        const streamData = await body.getReader().read();
        if (!streamData.value) {
          return;
        }

        const result = utf8decode(streamData.value);
        if (result === 'OK') {
          notify(`Successfully executed command ${command} on device ${device['device name']}`, {
            type: 'success',
          });
        }
      } catch (error) {
        notify(`Error: Could not execute command ${command} on device ${device['device name']}`, { type: 'error' });
      }
    },
    [authProvider, notify],
  );

  if (!record) return null;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }}>
        <ReferenceField source='is of-device type' reference='device type' link={false} emptyText=''>
          <FunctionField render={(type: { slug?: string }) => <BrandMark text={type?.slug} kind='board' size={26} />} />
        </ReferenceField>
        <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
          <Typography
            component='h2'
            sx={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record['device name']}</span>
            <DeviceFieldEditor
              source='device name'
              title='Device name'
              currentValue={record['device name']}
              required
              iconOnly
            />
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'var(--font-mono, monospace)' }}>
            {String(record.uuid ?? '').slice(0, 7)}
          </Typography>
        </Box>

        <FunctionField
          render={(fieldRecord: DeviceRecord) => {
            if (fieldRecord['is connected to vpn'] !== true) return null;
            return (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', '& .MuiButton-root': { height: 34 } }}>
                <Button variant='outlined' size='small' onClick={() => invokeSupervisor(fieldRecord, 'blink')} startIcon={<LightModeIcon />}>
                  Blink
                </Button>
                <Button
                  variant='outlined'
                  size='small'
                  startIcon={<RestartAltIcon />}
                  onClick={() =>
                    setConfirmationDialog({
                      title: 'Reboot Device',
                      content: 'Are you sure you want to reboot this device?',
                      onConfirm: () => invokeSupervisor(fieldRecord, 'reboot'),
                    })
                  }
                >
                  Reboot
                </Button>
                <Button
                  variant='outlined'
                  size='small'
                  startIcon={<PowerSettingsNewIcon />}
                  onClick={() =>
                    setConfirmationDialog({
                      title: 'Shutdown Device',
                      content: 'Are you sure you want to shut down this device?',
                      onConfirm: () => invokeSupervisor(fieldRecord, 'shutdown'),
                    })
                  }
                >
                  Shutdown
                </Button>
              </Box>
            );
          }}
        />
      </Box>

      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          borderTop: 1,
          borderLeft: 1,
          borderColor: 'divider',
          '& > div': { p: '12px 16px', borderRight: 1, borderBottom: 1, borderColor: 'divider', minWidth: 0 },
        }}
      >
        <Box>
          <StatLabel>
            Fleet
            <DeviceFieldEditor
              source='belongs to-application'
              title='Fleet'
              currentValue={record['belongs to-application']}
              required
              iconOnly
              loadChoices={loadFleetChoices}
              updateData={(applicationId) => ({
                'belongs to-application': applicationId,
                [isPinnedOnRelease]: null,
              })}
              onUpdated={(applicationId) => reconcileDeviceServices(record.id, applicationId as number | string)}
            />
          </StatLabel>
          <ReferenceField source='belongs to-application' reference='application'>
            <TextField source='app name' style={{ fontSize: 14, fontWeight: 500 }} />
          </ReferenceField>
        </Box>
        <Box>
          <StatLabel>Status</StatLabel>
          <OnlineField source={deviceOnlineStatusField} />
        </Box>
        <Box>
          <StatLabel>Heartbeat</StatLabel>
          <FunctionField render={(fieldRecord) => <HeartbeatStatusIcon record={fieldRecord} />} />
        </Box>
        <Box>
          <StatLabel>VPN</StatLabel>
          <FunctionField render={(fieldRecord) => <VpnStatusIcon record={fieldRecord} />} />
        </Box>
        {record.note && (
          <Box sx={{ gridColumn: '1 / -1', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            <StatLabel>Note</StatLabel>
            {record.note}
          </Box>
        )}
      </Box>

      {!!confirmationDialog && (
        <ConfirmationDialog {...confirmationDialog} onClose={() => setConfirmationDialog(null)} />
      )}
    </>
  );
};

export default ControlsWidget;
