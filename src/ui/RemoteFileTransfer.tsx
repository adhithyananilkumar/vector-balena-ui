import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { Alert, Box, Button, LinearProgress, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import React from 'react';
import { remoteTransferUrl, responseError, type RemoteTarget } from '../lib/builtInRemoteAccess';
import {
  formatTransferBytes,
  isAbsoluteDevicePath,
  isTransferCancellation,
  transferFilename,
} from '../lib/remoteAccessUi';
import { RemoteTargetSelect } from './RemoteTargetSelect';

interface SaveHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}
interface Picker {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveHandle>;
}
interface Props {
  token: string;
  deviceUuid: string;
  targets: RemoteTarget[];
}

export const RemoteFileTransfer: React.FC<Props> = ({ token, deviceUuid, targets }) => {
  const [mode, setMode] = React.useState<'upload' | 'download'>('upload');
  const [uploadTargetId, setUploadTargetId] = React.useState('host');
  const [downloadTargetId, setDownloadTargetId] = React.useState('host');
  const targetId = mode === 'upload' ? uploadTargetId : downloadTargetId;
  const selected = targets.find((target) => target.id === targetId);
  const [uploadPath, setUploadPath] = React.useState('');
  const [downloadPath, setDownloadPath] = React.useState('');
  const [file, setFile] = React.useState<File>();
  const [active, setActive] = React.useState(false);
  const [progress, setProgress] = React.useState<number>();
  const [bytes, setBytes] = React.useState(0);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [dragging, setDragging] = React.useState(false);
  const operation = React.useRef<AbortController | undefined>(undefined);
  React.useEffect(
    () => () => {
      operation.current?.abort();
      operation.current = undefined;
    },
    [token, deviceUuid],
  );
  React.useEffect(() => {
    setActive(false);
  }, [token, deviceUuid]);

  const transfer = async () => {
    const path = (mode === 'upload' ? uploadPath : downloadPath).trim();
    if (
      operation.current ||
      !token ||
      !deviceUuid ||
      !selected ||
      !isAbsoluteDevicePath(path) ||
      (mode === 'upload' && !file)
    )
      return;
    const controller = new AbortController();
    operation.current = controller;
    const current = () => operation.current === controller && !controller.signal.aborted;
    setActive(true);
    setProgress(undefined);
    setBytes(0);
    setError('');
    setMessage('');
    let received = 0;
    try {
      // Invoke the picker before the first await, while the click's user activation is still available.
      const picker = globalThis as typeof globalThis & Picker;
      const handlePromise =
        mode === 'download' && picker.showSaveFilePicker
          ? picker.showSaveFilePicker({ suggestedName: transferFilename(path) })
          : undefined;
      if (mode === 'upload') {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const abort = () => xhr.abort();
          controller.signal.addEventListener('abort', abort, { once: true });
          xhr.open('PUT', remoteTransferUrl('upload', deviceUuid, path, selected.container, selected.containerKind));
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.upload.onprogress = (event) => {
            if (!current()) return;
            setBytes(event.loaded);
            setProgress(event.lengthComputable ? (event.loaded / event.total) * 100 : undefined);
          };
          const finish = (failure?: Error) => {
            controller.signal.removeEventListener('abort', abort);
            if (failure) reject(failure);
            else resolve();
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) finish();
            else {
              let text = `Upload failed (${xhr.status}).`;
              try {
                const body = JSON.parse(xhr.responseText) as { message?: unknown };
                if (typeof body.message === 'string') text = body.message;
              } catch {
                /* The endpoint may return a non-JSON error. */
              }
              finish(new Error(text));
            }
          };
          xhr.onerror = () => finish(new Error('Upload failed. Check your connection.'));
          xhr.onabort = () => finish(new DOMException('Cancelled', 'AbortError'));
          xhr.send(file!);
        });
      } else {
        const handle = handlePromise ? await handlePromise : undefined;
        if (!current()) return;
        const response = await fetch(
          remoteTransferUrl('download', deviceUuid, path, selected.container, selected.containerKind),
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw await responseError(response, 'Download failed.');
        if (!response.body) throw new Error('The download did not contain a stream.');
        const total = Number(response.headers.get('Content-Length'));
        const stream = response.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, output) {
              received += chunk.byteLength;
              if (current()) {
                setBytes(received);
                setProgress(total > 0 ? Math.min(100, (received / total) * 100) : undefined);
              }
              output.enqueue(chunk);
            },
          }),
        );
        if (handle) {
          const writable = await handle.createWritable();
          await stream.pipeTo(writable, { signal: controller.signal });
        } else {
          const blob = await new Response(stream).blob();
          if (!current()) return;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = transferFilename(path);
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
      if (current()) {
        setProgress(100);
        setMessage(
          mode === 'upload'
            ? `Uploaded ${file?.name} to ${selected.label}: ${path}`
            : `Downloaded ${selected.label}: ${path} (${received.toLocaleString()} bytes)`,
        );
      }
    } catch (failure) {
      if (operation.current === controller) {
        if (isTransferCancellation(failure, controller.signal)) setMessage('Transfer cancelled.');
        else setError(failure instanceof Error ? failure.message : 'File transfer failed.');
      }
    } finally {
      controller.abort();
      if (operation.current === controller) {
        operation.current = undefined;
        setActive(false);
      }
    }
  };
  const path = mode === 'upload' ? uploadPath : downloadPath;
  const invalid = !!path && !isAbsoluteDevicePath(path);
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  return (
    <Box
      sx={{ borderTop: 1, borderColor: 'divider', bgcolor: '#0e131a', color: '#dbe4ee', px: 2.5, pt: 2, pb: 2.5, flexShrink: 0 }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
        <Stack direction='row' alignItems='center' spacing={2} sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>File transfer</Typography>
          <Tabs
            value={mode}
            onChange={(_, value: 'upload' | 'download') => setMode(value)}
            sx={{
              'minHeight': 32,
              'bgcolor': 'rgba(255,255,255,0.05)',
              'borderRadius': '8px',
              'p': '3px',
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab value='upload' label='Upload' disabled={active} sx={tabSx} />
            <Tab value='download' label='Download' disabled={active} sx={tabSx} />
          </Tabs>
        </Stack>
        <RemoteTargetSelect
          targets={targets}
          value={selected?.id ?? ''}
          onChange={(value) => {
            if (mode === 'upload') setUploadTargetId(value);
            else setDownloadTargetId(value);
            setError('');
            setMessage('');
            setProgress(undefined);
            setBytes(0);
          }}
          ariaLabel='File transfer target'
          label={mode === 'upload' ? 'Upload to' : 'Download from'}
          disabled={active}
          sx={{ minWidth: 180 }}
        />
      </Stack>
      {!selected && !active && (
        <Alert severity='warning' sx={{ mt: 1.5 }}>
          The selected target is no longer running. Choose another target.
        </Alert>
      )}
      {mode === 'upload' && (
        <Box
          component='label'
          onDragOver={(event: React.DragEvent) => {
            event.preventDefault();
            if (!active) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: React.DragEvent) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer?.files?.[0];
            if (!active && dropped) setFile(dropped);
          }}
          sx={{
            'mt': 1.75,
            'display': 'flex',
            'alignItems': 'center',
            'gap': 1.5,
            'px': 2,
            'py': 1.75,
            'borderRadius': '10px',
            'border': '1.5px dashed',
            'borderColor': dragging ? '#22d3ee' : file ? 'rgba(104,211,145,0.55)' : 'rgba(255,255,255,0.18)',
            'bgcolor': dragging ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.03)',
            'cursor': active ? 'default' : 'pointer',
            'transition': 'border-color .15s, background-color .15s',
            '&:hover': { borderColor: active ? undefined : 'rgba(255,255,255,0.35)' },
          }}
        >
          <input type='file' hidden disabled={active} onChange={(event) => setFile(event.target.files?.[0])} />
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(34,211,238,0.12)',
              color: '#22d3ee',
              flexShrink: 0,
            }}
          >
            <UploadIcon fontSize='small' />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {file ? file.name : 'Drop a file here, or click to choose'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#8da0b3' }}>
              {file
                ? `${formatTransferBytes(file.size)} · click to replace`
                : 'Streamed straight to the device; nothing is stored on the server'}
            </Typography>
          </Box>
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'flex-start' }} sx={{ mt: 1.75 }}>
        <TextField
          size='small'
          fullWidth
          label={`Absolute ${selected?.target === 'container' ? 'container' : 'device'} ${mode === 'upload' ? 'target' : 'source'} path`}
          placeholder={selected?.target === 'container' ? '/tmp/file.bin' : '/mnt/data/file.bin'}
          value={path}
          disabled={active}
          error={invalid}
          helperText={invalid ? 'Enter an absolute path starting with /' : undefined}
          sx={{
            'minWidth': 0,
            '& .MuiFormLabel-root': { fontSize: 12, fontWeight: 500 },
            '& .MuiInputBase-input': { fontFamily: mono, fontSize: 13 },
          }}
          onChange={(event) =>
            mode === 'upload' ? setUploadPath(event.target.value) : setDownloadPath(event.target.value)
          }
        />
        <Button
          size='medium'
          variant='contained'
          sx={{ flexShrink: 0, height: 40, px: 2.5, borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          startIcon={mode === 'upload' ? <UploadIcon /> : <DownloadIcon />}
          disabled={
            active || !token || !deviceUuid || !selected || !isAbsoluteDevicePath(path) || (mode === 'upload' && !file)
          }
          onClick={() => void transfer()}
        >
          {mode === 'upload' ? 'Upload' : 'Download'}
        </Button>
        {active && (
          <Button
            size='medium'
            color='warning'
            sx={{ flexShrink: 0, height: 40, textTransform: 'none' }}
            onClick={() => {
              operation.current?.abort();
              setMessage('Transfer cancelled.');
            }}
          >
            Cancel
          </Button>
        )}
      </Stack>
      {active && (
        <Box sx={{ mt: 1.75 }}>
          <LinearProgress
            variant={progress == null ? 'indeterminate' : 'determinate'}
            value={progress}
            sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)' }}
          />
          <Stack direction='row' justifyContent='space-between' sx={{ mt: 0.75 }}>
            <Typography sx={{ fontSize: 12, color: '#8da0b3', fontFamily: mono }}>
              {formatTransferBytes(bytes)} transferred
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#dbe4ee', fontFamily: mono }}>
              {progress == null ? '…' : `${Math.round(progress)}%`}
            </Typography>
          </Stack>
        </Box>
      )}
      {mode === 'download' && !(globalThis as typeof globalThis & Picker).showSaveFilePicker && (
        <Typography sx={{ display: 'block', mt: 1, fontSize: 12, color: '#8da0b3' }}>
          This browser saves downloads after receiving the file in browser memory.
        </Typography>
      )}
      {error && (
        <Alert severity='error' sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
      {message && !error && (
        <Typography sx={{ display: 'block', mt: 1.5, fontSize: 12.5, color: '#68d391', overflowWrap: 'anywhere' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

const tabSx = {
  'minHeight': 26,
  'py': 0.25,
  'px': 1.75,
  'borderRadius': '6px',
  'fontSize': 12.5,
  'textTransform': 'none',
  'color': '#8da0b3',
  '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' },
};
