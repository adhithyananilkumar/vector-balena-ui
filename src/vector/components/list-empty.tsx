import React from 'react';
import { useCreatePath, useResourceContext, useResourceDefinition } from 'react-admin';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from './button';
import { DeviceDoodle, EmptyBoxDoodle, FleetDoodle, KeyDoodle, PeopleDoodle } from './doodles';
import { EmptyState } from './empty-state';
import { VxScope } from './scope';

const humanize = (value: string): string => value.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());

/** Replaces react-admin's default "No X yet" screen for every list. */
const ListEmpty: React.FC = () => {
  const resource = useResourceContext() ?? '';
  const definition = useResourceDefinition({ resource });
  const createPath = useCreatePath();

  const label = String(definition.options?.label ?? humanize(resource));
  const singular = label.replace(/s$/i, '');
  const doodle =
    resource === 'application' ? (
      <FleetDoodle />
    ) : resource === 'device' ? (
      <DeviceDoodle />
    ) : resource === 'api key' || resource === 'user-has-public key' ? (
      <KeyDoodle />
    ) : resource === 'user' || resource === 'organization' ? (
      <PeopleDoodle />
    ) : (
      <EmptyBoxDoodle />
    );

  return (
    <VxScope className='flex flex-1 items-center justify-center'>
      <EmptyState
        doodle={doodle}
        title={`No ${label.toLowerCase()} yet`}
        text={definition.hasCreate ? `Create your first ${singular.toLowerCase()} to get started.` : 'Nothing has been recorded here yet.'}
        action={
          definition.hasCreate ? (
            <Button asChild variant='accent'>
              <Link to={createPath({ resource, type: 'create' })}>
                <Plus aria-hidden /> Create {singular.toLowerCase()}
              </Link>
            </Button>
          ) : undefined
        }
      />
    </VxScope>
  );
};

export default ListEmpty;
