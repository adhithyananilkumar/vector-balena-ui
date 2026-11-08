import { useMemo } from 'react';
import { useResourceDefinitions } from 'react-admin';
import {
  Boxes,
  Braces,
  Building2,
  CircuitBoard,
  Cpu,
  Database,
  Factory,
  Fingerprint,
  HardDrive,
  HardDriveDownload,
  GitCompareArrows,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Package,
  Server,
  Settings,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAccessContext } from '../../hooks/useAdminAccessContext';

export const groupIcons: Record<string, LucideIcon> = {
  'menu-access': ShieldCheck,
  'menu-fleet': Boxes,
  'menu-device': Cpu,
  'menu-image': Layers,
  'menu-release': Package,
  'menu-service': Server,
  'menu-static': Database,
};

/** One line-icon per resource; anything not listed falls back to its group's icon. */
export const resourceIcons: Record<string, LucideIcon> = {
  'organization': Building2,
  'user': Users,
  'api key': KeyRound,
  'user-has-public key': Fingerprint,
  'application': Boxes,
  'application config variable': SlidersHorizontal,
  'application environment variable': Braces,
  'application tag': Tag,
  'device': Cpu,
  'device config variable': SlidersHorizontal,
  'device environment variable': Braces,
  'device service environment variable': Braces,
  'device tag': Tag,
  'image': Layers,
  'image environment variable': Braces,
  'image label': Tag,
  'release': Package,
  'release tag': Tag,
  'service': Server,
  'service environment variable': Braces,
  'service label': Tag,
  'balena-os': HardDrive,
  'config': Settings,
  'cpu architecture': CircuitBoard,
  'device family': Shapes,
  'device manufacturer': Factory,
  'device type': Cpu,
  'device type alias': Link2,
  'application type': Shapes,
  'permission': Lock,
  'role': UserCog,
};

export interface NavLeaf {
  name: string;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  name: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

const humanize = (value: string): string =>
  value
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Navigation groups built from the registered resources, honouring role-based visibility. */
export const useNavGroups = (): NavGroup[] => {
  const definitions = useResourceDefinitions();
  const { context: accessContext } = useAdminAccessContext();

  return useMemo<NavGroup[]>(() => {
    const all = Object.values(definitions).filter(
      (resource) =>
        !resource.options?.globalAdminOnly ||
        (accessContext != null && (!accessContext.enforcementEnabled || accessContext.globalAdmin)),
    );
    const labelOf = (resource: (typeof all)[number]): string => String(resource.options?.label ?? humanize(resource.name));

    // pages that are not react-admin resources; shown to administrators only (they manage disk and downloads)
    const canProvision = accessContext != null && (!accessContext.enforcementEnabled || accessContext.globalAdmin);
    const provision: NavGroup[] = canProvision
      ? [
          {
            name: 'menu-provision',
            label: 'Provision',
            icon: HardDriveDownload,
            children: [
              { name: 'add-device', label: 'Add device', icon: Cpu },
              { name: 'base-images', label: 'Base images', icon: HardDriveDownload },
              { name: 'deltas', label: 'Delta builds', icon: GitCompareArrows },
            ],
          },
        ]
      : [];

    const resourceGroups = all
      .filter((resource) => resource.options?.isMenuParent && !resource.options?.hideFromMenu)
      .map((parent) => {
        const icon = groupIcons[parent.name] ?? Layers;
        return {
          name: parent.name,
          label: labelOf(parent),
          icon,
          children: parent.options?.hideChildren
            ? []
            : all
                .filter((resource) => resource.options?.menuParent === parent.name && resource.hasList)
                .map((resource) => ({ name: resource.name, label: labelOf(resource), icon: resourceIcons[resource.name] ?? icon })),
        };
      })
      .filter((group) => group.children.length > 0);

    // most-used first: what you operate daily, then provisioning, then build outputs, then administration
    const priority = ['menu-fleet', 'menu-device', 'menu-provision', 'menu-release', 'menu-image', 'menu-service', 'menu-access', 'menu-static'];
    const rank = (name: string) => {
      const index = priority.indexOf(name);
      return index === -1 ? priority.length : index;
    };
    return [...provision, ...resourceGroups].sort((a, b) => rank(a.name) - rank(b.name));
  }, [definitions, accessContext]);
};
