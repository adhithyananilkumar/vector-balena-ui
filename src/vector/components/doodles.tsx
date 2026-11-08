import React from 'react';

/**
 * Technical line-art illustrations. Strokes use currentColor, so the parent sets the tone with
 * a text color; `var(--accent)` marks the live / highlighted parts.
 */

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' };

const Brackets: React.FC<{ w: number; h: number; inset?: number; len?: number }> = ({ w, h, inset = 6, len = 18 }) => (
  <g stroke='currentColor' strokeOpacity='0.5' strokeWidth='1' fill='none'>
    <path d={`M${inset} ${inset + len} V${inset} H${inset + len}`} />
    <path d={`M${w - inset - len} ${inset} H${w - inset} V${inset + len}`} />
    <path d={`M${inset} ${h - inset - len} V${h - inset} H${inset + len}`} />
    <path d={`M${w - inset - len} ${h - inset} H${w - inset} V${h - inset - len}`} />
  </g>
);

const Cross: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <path d={`M${x - 3} ${y} H${x + 3} M${x} ${y - 3} V${y + 3}`} stroke='currentColor' strokeOpacity='0.28' strokeWidth='1' />
);

type NodeState = 'live' | 'idle';

const NODES: Array<{ x: number; y: number; state: NodeState; label: string; anchor: 'start' | 'end' | 'middle'; dx: number; dy: number }> = [
  { x: 240, y: 48, state: 'live', label: 'N-01', anchor: 'start', dx: 14, dy: 4 },
  { x: 348, y: 72, state: 'live', label: 'N-02', anchor: 'start', dx: 14, dy: 4 },
  { x: 400, y: 180, state: 'live', label: 'N-03', anchor: 'middle', dx: 0, dy: -16 },
  { x: 348, y: 288, state: 'live', label: 'N-04', anchor: 'start', dx: 14, dy: 4 },
  { x: 240, y: 312, state: 'idle', label: 'N-05', anchor: 'start', dx: 14, dy: 4 },
  { x: 132, y: 288, state: 'idle', label: 'N-06', anchor: 'end', dx: -14, dy: 4 },
  { x: 80, y: 180, state: 'idle', label: 'N-07', anchor: 'middle', dx: 0, dy: -16 },
  { x: 132, y: 72, state: 'live', label: 'N-08', anchor: 'end', dx: -14, dy: 4 },
];

const TRACES = [
  'M240 126 V56',
  'M294 180 H392',
  'M267 153 L308 112 H348 V80',
  'M267 207 L308 248 H348 V280',
  'M240 234 V304',
  'M213 207 L172 248 H132 V280',
  'M186 180 H88',
  'M213 153 L172 112 H132 V80',
];

/** Hub-and-nodes topology: the Vector mark at the centre, orthogonal traces out to devices. */
export const TopologyDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 480 360' className={className} role='img' aria-label='Fleet topology diagram'>
    <Brackets w={480} h={360} />
    {Array.from({ length: 7 }).flatMap((_, column) =>
      Array.from({ length: 5 }).map((__, row) => <Cross key={`${column}-${row}`} x={48 + column * 64} y={42 + row * 69} />),
    )}

    {TRACES.map((path) => (
      <g key={path} fill='none'>
        <path d={path} stroke='currentColor' strokeOpacity='0.45' strokeWidth='1' />
        <path d={path} stroke='var(--accent)' strokeWidth='1.5' strokeDasharray='3 9' className='animate-flow' />
      </g>
    ))}

    {/* hub */}
    <polygon points='240,126 294,180 240,234 186,180' fill='none' stroke='currentColor' strokeOpacity='0.4' strokeDasharray='2 5' />
    <polygon points='240,150 270,180 240,210 210,180' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />
    <path d='M233 169 L246 180 L233 191' fill='none' stroke='var(--accent)' strokeWidth='2.2' strokeLinecap='square' />

    {NODES.map((node) => (
      <g key={node.label}>
        <rect x={node.x - 8} y={node.y - 8} width='16' height='16' fill='var(--card)' stroke={node.state === 'live' ? 'var(--accent)' : 'currentColor'} strokeOpacity={node.state === 'live' ? 1 : 0.5} strokeWidth='1.5' />
        {node.state === 'live' && <rect x={node.x - 3} y={node.y - 3} width='6' height='6' fill='var(--accent)' />}
        <text x={node.x + node.dx} y={node.y + node.dy} textAnchor={node.anchor} fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
          {node.label}
        </text>
      </g>
    ))}

    <text x='28' y='42' fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
      FLEET / 08 NODES
    </text>
    <text x='28' y='338' fontSize='9' fill='currentColor' fillOpacity='0.45' style={mono}>
      VECTOR · TOPOLOGY
    </text>
    <text x='452' y='338' fontSize='9' textAnchor='end' fill='var(--accent)' style={mono}>
      04 / 08 LIVE
    </text>
  </svg>
);

/** Single-board device in plan view with dimension lines. */
export const DeviceDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 360 240' className={className} role='img' aria-label='Device illustration'>
    <Brackets w={360} h={240} />
    {/* construction lines */}
    <path d='M34 120 H326 M180 24 V204' stroke='currentColor' strokeOpacity='0.25' strokeDasharray='6 4' />

    {/* connectors on the top edge */}
    <rect x='86' y='34' width='38' height='26' fill='var(--card)' stroke='currentColor' strokeWidth='1.2' />
    <rect x='134' y='38' width='30' height='22' fill='var(--card)' stroke='currentColor' strokeWidth='1.2' />
    <path d='M92 44 H118 M92 50 H118' stroke='currentColor' strokeOpacity='0.5' />

    {/* board */}
    <rect x='60' y='60' width='240' height='130' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />
    {[
      [72, 72],
      [288, 72],
      [72, 178],
      [288, 178],
    ].map(([x, y]) => (
      <g key={`${x}-${y}`}>
        <circle cx={x} cy={y} r='5' fill='none' stroke='currentColor' strokeWidth='1.2' />
        <path d={`M${x - 8} ${y} H${x + 8} M${x} ${y - 8} V${y + 8}`} stroke='currentColor' strokeOpacity='0.3' />
      </g>
    ))}

    {/* SoC with pins */}
    <rect x='150' y='92' width='60' height='56' fill='none' stroke='currentColor' strokeWidth='1.5' />
    <circle cx='160' cy='102' r='3' fill='none' stroke='currentColor' />
    <rect x='170' y='112' width='20' height='16' fill='none' stroke='var(--accent)' strokeWidth='1.5' />
    {Array.from({ length: 6 }).map((_, index) => (
      <g key={index} stroke='currentColor' strokeOpacity='0.7'>
        <path d={`M${158 + index * 9} 92 V86 M${158 + index * 9} 148 V154`} />
      </g>
    ))}
    {Array.from({ length: 5 }).map((_, index) => (
      <g key={index} stroke='currentColor' strokeOpacity='0.7'>
        <path d={`M150 ${100 + index * 10} H144 M210 ${100 + index * 10} H216`} />
      </g>
    ))}

    {/* traces to the header */}
    <path d='M144 110 H112 V164 H150 M216 120 H236 V150' fill='none' stroke='currentColor' strokeOpacity='0.4' />

    {/* GPIO header + status LED */}
    {Array.from({ length: 13 }).map((_, index) => (
      <rect key={index} x={162 + index * 9} y='168' width='6' height='6' fill='none' stroke='currentColor' strokeOpacity='0.8' />
    ))}
    {Array.from({ length: 13 }).map((_, index) => (
      <rect key={index} x={162 + index * 9} y='177' width='6' height='6' fill='none' stroke='currentColor' strokeOpacity='0.8' />
    ))}
    <rect x='262' y='86' width='8' height='8' fill='var(--accent)' />

    {/* dimensions */}
    <g stroke='currentColor' strokeOpacity='0.6' fill='none'>
      <path d='M60 206 V218 M300 206 V218 M60 212 H300' />
      <path d='M64 209 L60 212 L64 215 M296 209 L300 212 L296 215' />
      <path d='M312 60 H324 M312 190 H324 M318 60 V190' />
    </g>
    <text x='180' y='207' textAnchor='middle' fontSize='9' fill='currentColor' fillOpacity='0.7' style={mono}>
      85.0
    </text>
    <text x='330' y='128' fontSize='9' fill='currentColor' fillOpacity='0.7' style={mono} transform='rotate(90 330 128)' textAnchor='middle'>
      56.0
    </text>
  </svg>
);

/** Three stacked rhombi, echoing the brand mark: a fleet is a layered group of devices. */
export const FleetDoodle: React.FC<{ className?: string }> = ({ className }) => {
  const layers = [
    { cy: 172, label: 'FLT-C', accent: false },
    { cy: 136, label: 'FLT-B', accent: false },
    { cy: 100, label: 'FLT-A', accent: true },
  ];
  const diamond = (cy: number) => `180,${cy - 50} 280,${cy} 180,${cy + 50} 80,${cy}`;
  return (
    <svg viewBox='0 0 360 240' className={className} role='img' aria-label='Fleet illustration'>
      <Brackets w={360} h={240} />
      <path d='M180 24 V216' stroke='currentColor' strokeOpacity='0.2' strokeDasharray='6 4' />
      {layers.map((layer) => (
        <g key={layer.label}>
          <polygon points={diamond(layer.cy)} fill='var(--card)' stroke={layer.accent ? 'var(--accent)' : 'currentColor'} strokeOpacity={layer.accent ? 1 : 0.7} strokeWidth='1.5' />
          <path d={`M280 ${layer.cy} H316`} stroke='currentColor' strokeOpacity='0.4' strokeDasharray='3 3' />
          <text x='322' y={layer.cy + 3} fontSize='9' fill='currentColor' fillOpacity='0.65' style={mono}>
            {layer.label}
          </text>
        </g>
      ))}
      {/* top layer grid + hub */}
      <polygon points='180,70 230,100 180,130 130,100' fill='none' stroke='var(--accent)' strokeOpacity='0.5' strokeDasharray='2 4' />
      <path d='M173 93 L184 100 L173 107' fill='none' stroke='var(--accent)' strokeWidth='2' />
      <rect x='224' y='96' width='8' height='8' transform='rotate(45 228 100)' fill='var(--accent)' />
      <text x='36' y='36' fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
        GROUPS / 00
      </text>
    </svg>
  );
};

/** An open, empty shipping box with an item waiting to be dropped in: the generic "nothing here yet". */
export const EmptyBoxDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 360 240' className={className} role='img' aria-label='Empty box'>
    <Brackets w={360} h={240} />
    <path d='M34 196 H326' stroke='currentColor' strokeOpacity='0.18' strokeDasharray='6 4' />

    {/* the missing item, dropping in */}
    <polygon points='180,18 204,30 180,42 156,30' fill='none' stroke='var(--accent)' strokeWidth='1.5' strokeDasharray='3 3' />
    <path d='M156 30 V42 M204 30 V42 M180 42 V54' stroke='var(--accent)' strokeOpacity='0.6' strokeDasharray='3 3' />
    <path d='M180 58 V92' stroke='var(--accent)' strokeWidth='1.5' strokeDasharray='3 4' className='animate-flow' fill='none' />
    <polygon points='174,88 186,88 180,98' fill='var(--accent)' />

    {/* box: inside walls, floor, then the two front faces */}
    <polygon points='110,104 180,70 180,128 110,162' fill='var(--card)' stroke='currentColor' strokeOpacity='0.55' />
    <polygon points='180,70 250,104 250,162 180,128' fill='var(--card)' stroke='currentColor' strokeOpacity='0.55' />
    <polygon points='110,162 180,128 250,162 180,196' fill='none' stroke='currentColor' strokeOpacity='0.4' strokeDasharray='3 3' />
    <polygon points='110,104 180,138 180,196 110,162' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />
    <polygon points='180,138 250,104 250,162 180,196' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />

    {/* shipping label and status stripe */}
    <polygon points='122,126 150,140 150,156 122,142' fill='none' stroke='currentColor' strokeOpacity='0.5' />
    <path d='M127 133 L145 142 M127 139 L141 146' stroke='currentColor' strokeOpacity='0.4' />
    <polygon points='198,140 232,123 232,131 198,148' fill='var(--accent)' />

    {/* height dimension */}
    <g stroke='currentColor' strokeOpacity='0.55' fill='none'>
      <path d='M268 104 V162 M264 104 H272 M264 162 H272' />
    </g>
    <text x='279' y='137' fontSize='9' fill='currentColor' fillOpacity='0.65' style={mono}>
      00
    </text>

    <text x='28' y='42' fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
      ITEMS / 00
    </text>
    <text x='180' y='224' textAnchor='middle' fontSize='9' fill='currentColor' fillOpacity='0.55' style={mono}>
      NO RECORDS
    </text>
  </svg>
);

/** Kept for existing imports. */
export const EmptyFrameDoodle = EmptyBoxDoodle;

/** A key and its dimension line, for API keys and SSH keys. */
export const KeyDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 360 240' className={className} role='img' aria-label='Key illustration'>
    <Brackets w={360} h={240} />
    <path d='M44 120 H316' stroke='currentColor' strokeOpacity='0.22' strokeDasharray='6 4' />
    <circle cx='112' cy='120' r='50' fill='none' stroke='currentColor' strokeOpacity='0.3' strokeDasharray='3 4' />
    <circle cx='112' cy='120' r='38' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />
    <circle cx='112' cy='120' r='15' fill='none' stroke='currentColor' strokeWidth='1.5' />
    <rect x='107' y='115' width='10' height='10' fill='var(--accent)' />
    <path d='M148 112 H274 V140 H262 V127 H250 V135 H238 V127 H148' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' strokeLinejoin='miter' />
    <path d='M160 120 H226' stroke='currentColor' strokeOpacity='0.4' />
    <g stroke='currentColor' strokeOpacity='0.6' fill='none'>
      <path d='M74 178 V190 M274 178 V190 M74 184 H274' />
      <path d='M78 181 L74 184 L78 187 M270 181 L274 184 L270 187' />
    </g>
    <text x='174' y='176' textAnchor='middle' fontSize='9' fill='currentColor' fillOpacity='0.7' style={mono}>
      86.0
    </text>
    <text x='28' y='42' fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
      KEYS / 00
    </text>
    <text x='332' y='226' textAnchor='end' fontSize='9' fill='currentColor' fillOpacity='0.5' style={mono}>
      NO RECORDS
    </text>
  </svg>
);

/** An ID card with two ghost cards behind it, for users and organizations. */
export const PeopleDoodle: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 360 240' className={className} role='img' aria-label='Members illustration'>
    <Brackets w={360} h={240} />
    <path d='M180 24 V216' stroke='currentColor' strokeOpacity='0.18' strokeDasharray='6 4' />
    {/* ghost cards */}
    <rect x='84' y='86' width='160' height='104' fill='none' stroke='currentColor' strokeOpacity='0.28' strokeDasharray='4 4' />
    <rect x='116' y='54' width='160' height='104' fill='none' stroke='currentColor' strokeOpacity='0.28' strokeDasharray='4 4' />
    {/* card */}
    <rect x='100' y='70' width='160' height='104' fill='var(--card)' stroke='currentColor' strokeWidth='1.5' />
    <path d='M164 70 V84 H196 V70' fill='none' stroke='currentColor' strokeOpacity='0.6' />
    <rect x='116' y='96' width='44' height='44' fill='none' stroke='currentColor' strokeOpacity='0.7' />
    <circle cx='138' cy='111' r='7' fill='none' stroke='currentColor' strokeWidth='1.3' />
    <path d='M124 136 C124 124 152 124 152 136' fill='none' stroke='currentColor' strokeWidth='1.3' />
    <path d='M172 102 H244 M172 116 H228 M172 130 H238' stroke='currentColor' strokeOpacity='0.45' strokeWidth='2' />
    <rect x='116' y='152' width='36' height='6' fill='var(--accent)' />
    <path d='M160 155 H244' stroke='currentColor' strokeOpacity='0.3' />
    <text x='28' y='42' fontSize='9' fill='currentColor' fillOpacity='0.6' style={mono}>
      MEMBERS / 00
    </text>
    <text x='332' y='226' textAnchor='end' fontSize='9' fill='currentColor' fillOpacity='0.5' style={mono}>
      NO RECORDS
    </text>
  </svg>
);
