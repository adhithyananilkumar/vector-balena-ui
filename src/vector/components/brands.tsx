import React from 'react';
import { FunctionField, useRecordContext, type FunctionFieldProps } from 'react-admin';
import { useTheme } from '@mui/material';
import { CircuitBoard, Cpu, Factory, Server, type LucideIcon } from 'lucide-react';
import deviceTypeCatalog from '../data/deviceTypes.json';
import {
  siAmd,
  siArduino,
  siArm,
  siAsus,
  siBroadcom,
  siCisco,
  siDell,
  siEspressif,
  siGoogle,
  siHuawei,
  siIntel,
  siLenovo,
  siMediatek,
  siNvidia,
  siNxp,
  siQemu,
  siQualcomm,
  siRaspberrypi,
  siSamsung,
  siSiemens,
  siSony,
  siStmicroelectronics,
  siXiaomi,
  type SimpleIcon,
} from 'simple-icons';

export type BrandKind = 'board' | 'arch' | 'maker';

interface CatalogEntry {
  name: string;
  aliases?: string[];
  logo?: boolean;
}
const catalog = deviceTypeCatalog as Record<string, CatalogEntry>;
const aliasIndex = new Map<string, string>();
for (const [slug, entry] of Object.entries(catalog)) for (const alias of entry.aliases ?? []) aliasIndex.set(alias, slug);

/** Display name and board logo for a device type slug, from balena's public hardware catalogue. */
export const lookupDeviceType = (slug: unknown): { slug: string; name: string; logo?: string } | undefined => {
  const key = String(slug ?? '');
  const resolved = catalog[key] ? key : aliasIndex.get(key);
  const entry = resolved ? catalog[resolved] : undefined;
  if (!resolved || !entry) return undefined;
  return { slug: resolved, name: entry.name, logo: entry.logo ? `/device-types/${resolved}.svg` : undefined };
};

interface Brand {
  name: string;
  /** Official mark from the simple-icons set. */
  icon?: SimpleIcon;
  /** Two or three letters used when no official mark is available. */
  mono?: string;
}

const logo = (name: string, icon: SimpleIcon): Brand => ({ name, icon });
const mono = (name: string, letters: string): Brand => ({ name, mono: letters });

/** First match wins, so more specific makers are listed before the chip families they use. */
const boardRules: Array<[RegExp, Brand]> = [
  // generic PC / architecture images belong to no single maker: show the neutral icon, not AMD or Intel
  [/^generic/, { name: 'Generic' }],
  [/raspberry|^rpi|raspberrypi|^fin/, logo('Raspberry Pi', siRaspberrypi)],
  [/jetson|\btx[12]\b|tx2|xavier|orin|\born\b|agx|nvidia|cnx100/, logo('NVIDIA', siNvidia)],
  [/intel|\bnuc|edison|^up-|up-board|up-squared|up-core/, logo('Intel', siIntel)],
  [/iot2|simatic|siemens/, logo('Siemens', siSiemens)],
  [/asus|tinker/, logo('ASUS', siAsus)],
  [/artik|samsung/, logo('Samsung', siSamsung)],
  [/coral|google/, logo('Google', siGoogle)],
  [/stm32|stmicro|nucleo/, logo('STMicroelectronics', siStmicroelectronics)],
  [/dell/, logo('Dell', siDell)],
  [/lenovo/, logo('Lenovo', siLenovo)],
  [/cisco/, logo('Cisco', siCisco)],
  [/huawei/, logo('Huawei', siHuawei)],
  [/xiaomi/, logo('Xiaomi', siXiaomi)],
  [/sony/, logo('Sony', siSony)],
  [/mediatek|\bmt\d{4}|aiot/, logo('MediaTek', siMediatek)],
  [/qualcomm|dragonboard|apq|msm\d|\brb[1-6]\b|db410|db820/, logo('Qualcomm', siQualcomm)],
  [/broadcom|bcm\d/, logo('Broadcom', siBroadcom)],
  [/espressif|esp32/, logo('Espressif', siEspressif)],
  [/arduino/, logo('Arduino', siArduino)],
  [/qemu/, logo('QEMU', siQemu)],
  [/amd|ryzen|epyc/, logo('AMD', siAmd)],
  [/beagle|bbb|bbxm/, mono('BeagleBoard', 'BB')],
  [/am57|am335|am437|j721|\bti\b|texas/, mono('Texas Instruments', 'TI')],
  [/apalis|colibri|verdin|toradex/, mono('Toradex', 'TDX')],
  [/imx|^ls10|^ls20|nxp|freescale|variscite|var-som|ccimx|cl-som|mcimx/, logo('NXP', siNxp)],
  [/rk3|rock|firefly|aio-3|rockchip/, mono('Rockchip', 'RK')],
  [/odroid/, mono('Hardkernel', 'HK')],
  [/orangepi|orange-pi|opi/, mono('Orange Pi', 'OP')],
  [/bananapi|banana-pi|bpi/, mono('Banana Pi', 'BP')],
  [/nanopi|friendlyarm|friendlyelec/, mono('FriendlyElec', 'FE')],
  [/khadas|\bvim\d/, mono('Khadas', 'KH')],
  [/zynq|xilinx|ultra96|kria/, mono('Xilinx', 'XLX')],
  [/advantech/, mono('Advantech', 'ADV')],
];

const archRules: Array<[RegExp, Brand]> = [
  [/aarch64|arm|rpi/, logo('Arm', siArm)],
  [/amd64|x86[_-]?64/, mono('x86-64', 'x64')],
  [/i386|i686|x86/, mono('x86', 'x86')],
];

export const resolveBrand = (text: unknown, kind: BrandKind = 'board'): Brand | null => {
  const value = String(text ?? '').toLowerCase();
  if (!value) return null;
  const rules = kind === 'arch' ? [...archRules, ...boardRules] : boardRules;
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? null;
};

const fallbackIcon = (text: unknown, kind: BrandKind): LucideIcon => {
  if (kind === 'maker') return Factory;
  if (kind === 'arch') return Cpu;
  const value = String(text ?? '').toLowerCase();
  if (/x86|amd64|generic|qemu/.test(value)) return Server;
  return CircuitBoard;
};

const luminance = (hex: string): number => {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

const SLOT_WIDTH = 44;

const tileStyle = (size: number): React.CSSProperties => ({
  display: 'inline-grid',
  placeItems: 'center',
  width: size + 14,
  height: size + 14,
  flexShrink: 0,
  background: '#ffffff',
  border: '1px solid rgba(128,128,128,0.25)',
  padding: 3,
  boxSizing: 'border-box',
  color: '#27272a',
});
const boxCache = new Map<string, { x: number; y: number; w: number; h: number }>();

/** Draws an official mark fitted to its own proportions, so wide wordmarks stay legible. */
const LogoSvg: React.FC<{ icon: SimpleIcon; size: number; fill: string }> = ({ icon, size, fill }) => {
  const pathRef = React.useRef<SVGPathElement>(null);
  const [box, setBox] = React.useState(() => boxCache.get(icon.slug) ?? { x: 0, y: 0, w: 24, h: 24 });

  React.useLayoutEffect(() => {
    if (boxCache.has(icon.slug)) return;
    const measured = pathRef.current?.getBBox();
    if (measured && measured.width > 0 && measured.height > 0) {
      const next = { x: measured.x, y: measured.y, w: measured.width, h: measured.height };
      boxCache.set(icon.slug, next);
      setBox(next);
    }
  }, [icon.slug]);

  const scale = Math.min(SLOT_WIDTH / box.w, size / box.h);
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={box.w * scale}
      height={box.h * scale}
      role='img'
      aria-label={icon.title}
      style={{ flexShrink: 0 }}
    >
      <title>{icon.title}</title>
      <path ref={pathRef} d={icon.path} fill={fill} />
    </svg>
  );
};

/** A company mark for a device type, architecture or maker. Inline styles only, so it works inside MUI menus. */
export const BrandMark: React.FC<{ text: unknown; kind?: BrandKind; size?: number }> = ({ text, kind = 'board', size = 16 }) => {
  const dark = useTheme().palette.mode === 'dark';
  const board = kind === 'board' ? lookupDeviceType(text) : undefined;
  if (board?.logo) {
    // product logos are drawn for light backgrounds, so they always sit on a light tile
    return (
      <span style={tileStyle(size)}>
        <img src={board.logo} alt='' decoding='async' style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </span>
    );
  }
  const brand = resolveBrand(text, kind);

  // every mark sits in the same fixed slot, so names line up whatever the logo's shape
  const slot: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: kind === 'board' ? size + 14 : SLOT_WIDTH,
    height: size,
    flexShrink: 0,
  };

  if (brand?.icon) {
    return (
      <span style={tileStyle(size)} title={brand.name}>
        <LogoSvg icon={brand.icon} size={size - 2} fill={`#${brand.icon.hex}`} />
      </span>
    );
  }

  if (brand?.mono) {
    return (
      <span
        title={brand.name}
        aria-label={brand.name}
        style={{
          ...tileStyle(size),
          padding: 0,
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: Math.max(8, Math.round(size * 0.42) - (brand.mono.length > 2 ? 1 : 0)),
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {brand.mono}
      </span>
    );
  }

  const Icon = fallbackIcon(text, kind);
  return (
    <span style={{ ...tileStyle(size), background: 'transparent', color: 'inherit' }}>
      <Icon size={size} strokeWidth={1.6} style={{ opacity: 0.55 }} aria-hidden />
    </span>
  );
};

export const BrandLabel: React.FC<{ text: unknown; kind?: BrandKind }> = ({ text, kind = 'board' }) => {
  const board = kind === 'board' ? lookupDeviceType(text) : undefined;
  const slug = String(text ?? '');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <BrandMark text={text} kind={kind} />
      {board ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.25 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</span>
          {board.slug !== slug || board.name !== slug ? (
            <span style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 11, opacity: 0.55 }}>{slug}</span>
          ) : null}
        </span>
      ) : (
        <span>{slug}</span>
      )}
    </span>
  );
};

const makeOption = (kind: BrandKind): React.FC => {
  const Option: React.FC = () => {
    const record = useRecordContext();
    return <BrandLabel text={record?.slug ?? record?.name} kind={kind} />;
  };
  Option.displayName = `${kind}Option`;
  return Option;
};

/** Option rows for the select inputs. */
export const DeviceTypeOption = makeOption('board');
export const ArchitectureOption = makeOption('arch');
export const FamilyOption = makeOption('board');
export const ManufacturerOption = makeOption('maker');

/** Table / reference cell: logo + slug. */
export const BrandSlugField: React.FC<Omit<FunctionFieldProps, 'render'> & { kind?: BrandKind }> = ({ kind = 'board', ...props }) => (
  <FunctionField {...props} render={(record: Record<string, unknown>) => <BrandLabel text={record?.slug} kind={kind} />} />
);
