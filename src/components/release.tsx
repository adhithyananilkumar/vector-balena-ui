import * as React from 'react';
import {
  BooleanField,
  ChipField,
  Datagrid,
  DateField,
  FunctionField,
  List,
  ReferenceField,
  ReferenceManyCount,
  ReferenceManyField,
  SearchInput,
  SingleFieldList,
  TextField,
  Toolbar,
  useDataProvider,
} from 'react-admin';
import type { FunctionFieldProps, RaRecord } from 'react-admin';
import DeleteReleaseButton from '../ui/DeleteReleaseButton';
import RenameReleaseButton, { releaseDisplayName } from '../ui/RenameReleaseButton';
import SemVerTextField from '../ui/SemVerTextField';

const releaseFilters = [<SearchInput source='note@ilike' placeholder='Search by name' alwaysOn />];

type BooleanBinaryFieldProps = Omit<FunctionFieldProps<RaRecord>, 'render'>;

const BooleanBinaryField: React.FC<BooleanBinaryFieldProps> = ({ source = 'enabled', ...props }) => (
  <FunctionField
    {...props}
    source={source}
    render={(record: RaRecord) => {
      const rawValue = record[source];
      const enabled = rawValue === 1 || rawValue === true;

      return <BooleanField source='enabled' record={{ ...record, enabled }} />;
    }}
  />
);

const TagChipField: React.FC = (props) => {
  return (
    <FunctionField
      {...props}
      render={(record) => (
        <ChipField source='tag' record={{ ...record, tag: `${record['tag key']}: ${record['value']}` }} />
      )}
    />
  );
};

export const ReleaseList: React.FC = (props) => {
  return (
    <List filters={releaseFilters} sort={{ field: 'version', order: 'DESC' }}>
      <Datagrid
        size='medium'
        rowClick={false}
        bulkActionButtons={
          <DeleteReleaseButton size='small' context={useDataProvider()} {...props}>
            Delete
          </DeleteReleaseButton>
        }
      >
        <ReferenceField label='Fleet' source='belongs to-application' reference='application' sortable={false}>
          <TextField source='app name' />
        </ReferenceField>
        <ReferenceField
          label='Host'
          source='belongs to-application'
          reference='application'
          sortable={false}
          link={false}
        >
          <BooleanBinaryField source='is host' />
        </ReferenceField>
        <FunctionField
          label='Release'
          sortable={false}
          render={(record: RaRecord) => (
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600 }}>{releaseDisplayName(record)}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>{String(record.commit ?? '').slice(0, 7)}</div>
            </div>
          )}
        />
        <SemVerTextField label='Version' sortable sortBy='version' />
        <DateField label='Date' source='created at' />
        <ReferenceManyCount
          label='Devices'
          source='id'
          reference='device'
          target='is running-release'
          link={false}
          sortable={true}
        />

        <TextField label='Status' source='status' />

        <ReferenceManyField label='Tags' source='id' reference='release tag' target='release'>
          <SingleFieldList linkType={false}>
            <TagChipField />
          </SingleFieldList>
        </ReferenceManyField>

        <Toolbar>
          <RenameReleaseButton />
          <DeleteReleaseButton variant='outlined' size='small' context={useDataProvider()} />
        </Toolbar>
      </Datagrid>
    </List>
  );
};

const release = {
  list: ReleaseList,
};

export default release;
