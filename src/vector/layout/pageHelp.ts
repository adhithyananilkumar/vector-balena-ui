export interface PageHelp {
  /** One-line summary shown in bold. */
  summary: string;
  /** Extra detail, one paragraph each. */
  details?: string[];
}

/** Help text for the (i) button next to the page title, keyed by the first segment of the route. */
const help: Record<string, PageHelp> = {
  'add-device': {
    summary: 'Create a flash-ready image for a new device.',
    details: [
      'Choose a fleet and balenaOS version, then pick mode, provisioning and network. Download a full image to flash with Etcher, or just config.json for a drive you already flashed.',
      'Fleet-wide images work for any number of devices. "This device only" registers one device now and gives it its own key.',
      'The image streams from balena\'s download service through Vector to your computer, with the fleet config written into it on the way. Nothing is stored on the server. In Chrome or Edge you can pick the folder it is saved to.',
    ],
  },
  'deltas': {
    summary: 'How each delta update was built and how much it saved.',
    details: [
      'A delta is the difference between two releases of a service, so a device downloads only what changed instead of the whole image.',
      'Deltas are built the first time a device asks for an update, then reused. Turn them on per fleet with BALENA_SUPERVISOR_DELTA=1.',
      'Size is what is stored in the registry (compressed). Build time is split into pulling both images, diffing them and uploading the result.',
    ],
  },
  'application': { summary: 'Fleets group devices that run the same software and share settings.' },
  'device': {
    summary: 'Every device registered on this server.',
    details: ['To add a new physical device, use Add device under Provision. It creates the registration and the config for you.'],
  },
  'release': { summary: 'Versions of a fleet’s software. Devices update to the release their fleet targets.' },
  'image': { summary: 'Container images built for each release.' },
  'service': { summary: 'The containers that make up a fleet’s application.' },
};

export const pageHelpFor = (pathname: string): PageHelp | undefined => {
  const key = decodeURIComponent(pathname).split('/').filter(Boolean)[0];
  return key ? help[key] : undefined;
};
