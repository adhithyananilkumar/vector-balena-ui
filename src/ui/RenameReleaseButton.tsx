import EditIcon from '@mui/icons-material/Edit';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField as MuiTextField } from '@mui/material';
import React, { useState } from 'react';
import { useNotify, useRecordContext, useRefresh, useUpdate } from 'react-admin';

/** A release's display name is its note (what `balena deploy --note` sets); without one it shows the commit. */
export const releaseDisplayName = (release: Record<string, any> | undefined): string => {
  const note = String(release?.note ?? '').trim().split('\n')[0];
  return note || `Release ${String(release?.commit ?? '').slice(0, 7) || 'unknown'}`;
};

const RenameReleaseButton: React.FC = () => {
  const record = useRecordContext<Record<string, any>>();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  if (!record) return null;

  const save = () =>
    update(
      'release',
      { id: record.id, data: { note: name.trim() }, previousData: record },
      {
        onSuccess: () => {
          notify('Release renamed', { type: 'success' });
          setOpen(false);
          refresh();
        },
        onError: (error) => notify(error instanceof Error ? error.message : 'Could not rename the release', { type: 'error' }),
      },
    );

  return (
    <>
      <Button
        size='small'
        variant='outlined'
        startIcon={<EditIcon fontSize='small' />}
        onClick={() => {
          setName(String(record.note ?? ''));
          setOpen(true);
        }}
      >
        Rename
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth='xs'>
        <DialogTitle>Name this release</DialogTitle>
        <DialogContent>
          <MuiTextField
            autoFocus
            fullWidth
            margin='dense'
            label='Release name'
            helperText='Shown instead of the commit hash. Deploy with --note "name" to set it from the CLI.'
            value={name}
            inputProps={{ maxLength: 120 }}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !isPending && save()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant='contained' disabled={isPending} onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RenameReleaseButton;
