import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

type GlyphKind =
  | 'skyline-ny'
  | 'skyline-tokyo'
  | 'skyline-london'
  | 'skyline-paris'
  | 'skyline-generic'
  | 'palm'
  | 'mountain'
  | 'sun'
  | 'wave'
  | 'coast'
  | 'compass';

const GLYPH_BY_IATA: Record<string, GlyphKind> = {
  JFK: 'skyline-ny',
  LGA: 'skyline-ny',
  EWR: 'skyline-ny',
  LAX: 'palm',
  MIA: 'palm',
  LAS: 'sun',
  PHX: 'sun',
  SFO: 'coast',
  SEA: 'coast',
  BOS: 'skyline-generic',
  ORD: 'skyline-generic',
  ATL: 'skyline-generic',
  DFW: 'sun',
  DEN: 'mountain',
  LHR: 'skyline-london',
  LGW: 'skyline-london',
  STN: 'skyline-london',
  CDG: 'skyline-paris',
  ORY: 'skyline-paris',
  AMS: 'skyline-generic',
  FRA: 'skyline-generic',
  MUC: 'mountain',
  MAD: 'sun',
  BCN: 'coast',
  FCO: 'skyline-generic',
  DUB: 'coast',
  IST: 'skyline-generic',
  DXB: 'skyline-generic',
  DOH: 'sun',
  SIN: 'palm',
  HKG: 'skyline-generic',
  NRT: 'skyline-tokyo',
  HND: 'skyline-tokyo',
  ICN: 'skyline-generic',
  PEK: 'skyline-generic',
  PVG: 'skyline-generic',
  BKK: 'palm',
  SYD: 'coast',
  MEL: 'coast',
};

function kindFor(iata: string | undefined): GlyphKind {
  if (!iata) return 'compass';
  return GLYPH_BY_IATA[iata.toUpperCase()] ?? 'skyline-generic';
}

export default function GeoGlyph({
  iata,
  kind,
  size = 64,
  color = '#1a1f2e',
  accent,
}: {
  iata?: string;
  kind?: GlyphKind;
  size?: number;
  color?: string;
  accent?: string;
}) {
  const resolved = kind ?? kindFor(iata);
  const a = accent ?? color;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {renderGlyph(resolved, color, a)}
    </Svg>
  );
}

function renderGlyph(kind: GlyphKind, c: string, a: string) {
  switch (kind) {
    case 'skyline-ny':
      return (
        <>
          <Rect x="8" y="34" width="6" height="22" fill={c} />
          <Rect x="16" y="22" width="6" height="34" fill={c} />
          <Rect x="24" y="14" width="4" height="42" fill={a} />
          <Polygon points="26,14 26,8 26.5,14" fill={a} />
          <Rect x="30" y="26" width="6" height="30" fill={c} />
          <Rect x="38" y="18" width="5" height="38" fill={c} />
          <Rect x="45" y="30" width="6" height="26" fill={c} />
          <Rect x="53" y="38" width="5" height="18" fill={c} />
        </>
      );
    case 'skyline-tokyo':
      return (
        <>
          <Rect x="8" y="40" width="5" height="16" fill={c} />
          <Rect x="15" y="30" width="5" height="26" fill={c} />
          <Polygon points="26,10 32,56 20,56" fill={a} />
          <Rect x="25" y="22" width="2" height="2" fill="#ffffff" />
          <Rect x="31" y="22" width="2" height="2" fill="#ffffff" />
          <Rect x="36" y="34" width="6" height="22" fill={c} />
          <Rect x="44" y="28" width="5" height="28" fill={c} />
          <Rect x="51" y="36" width="6" height="20" fill={c} />
        </>
      );
    case 'skyline-london':
      return (
        <>
          <Rect x="6" y="36" width="6" height="20" fill={c} />
          <Rect x="14" y="28" width="6" height="28" fill={c} />
          <Rect x="22" y="18" width="4" height="38" fill={a} />
          <Rect x="20" y="16" width="8" height="4" fill={a} />
          <Circle cx="24" cy="22" r="2.5" fill="#ffffff" />
          <Rect x="30" y="30" width="5" height="26" fill={c} />
          <Polygon points="40,24 46,14 52,24 52,56 40,56" fill={c} />
          <Rect x="44" y="32" width="4" height="6" fill="#ffffff" />
          <Rect x="54" y="40" width="4" height="16" fill={c} />
        </>
      );
    case 'skyline-paris':
      return (
        <>
          <Rect x="6" y="44" width="6" height="12" fill={c} />
          <Rect x="14" y="38" width="5" height="18" fill={c} />
          <Polygon points="32,6 22,56 42,56" fill={a} />
          <Line x1="24" y1="40" x2="40" y2="40" stroke={c} strokeWidth="1.5" />
          <Line x1="26" y1="30" x2="38" y2="30" stroke={c} strokeWidth="1.2" />
          <Rect x="46" y="40" width="5" height="16" fill={c} />
          <Rect x="53" y="34" width="5" height="22" fill={c} />
        </>
      );
    case 'skyline-generic':
      return (
        <>
          <Rect x="6" y="36" width="7" height="20" fill={c} />
          <Rect x="15" y="28" width="6" height="28" fill={c} />
          <Rect x="23" y="22" width="7" height="34" fill={a} />
          <Rect x="32" y="30" width="6" height="26" fill={c} />
          <Rect x="40" y="18" width="6" height="38" fill={c} />
          <Rect x="48" y="26" width="6" height="30" fill={c} />
          <Rect x="56" y="36" width="4" height="20" fill={c} />
        </>
      );
    case 'palm':
      return (
        <>
          <Line x1="32" y1="56" x2="28" y2="28" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M28 28 Q12 24 6 14" stroke={a} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Path d="M28 28 Q18 16 14 4" stroke={a} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Path d="M28 28 Q40 20 54 10" stroke={a} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Path d="M28 28 Q44 30 58 24" stroke={a} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Path d="M28 28 Q30 18 34 4" stroke={a} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <Line x1="6" y1="56" x2="60" y2="56" stroke={c} strokeWidth="1.5" />
        </>
      );
    case 'mountain':
      return (
        <>
          <Polygon points="4,56 22,22 34,40 40,30 60,56" fill={c} />
          <Polygon points="16,32 22,22 28,32" fill="#ffffff" />
          <Polygon points="36,36 40,30 44,36" fill="#ffffff" />
          <Circle cx="50" cy="12" r="4" fill={a} />
        </>
      );
    case 'sun':
      return (
        <>
          <Circle cx="32" cy="32" r="12" fill={a} />
          <Line x1="32" y1="6" x2="32" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="32" y1="50" x2="32" y2="58" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="6" y1="32" x2="14" y2="32" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="50" y1="32" x2="58" y2="32" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="14" y1="14" x2="19" y2="19" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="45" y1="45" x2="50" y2="50" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="50" y1="14" x2="45" y2="19" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <Line x1="19" y1="45" x2="14" y2="50" stroke={c} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'wave':
      return (
        <>
          <Path d="M2 38 Q16 28 32 38 T62 38" stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M2 46 Q16 36 32 46 T62 46" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M2 54 Q16 44 32 54 T62 54" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      );
    case 'coast':
      return (
        <>
          <Circle cx="50" cy="16" r="5" fill={a} />
          <Path d="M0 40 Q20 32 32 40 T64 40 L64 64 L0 64 Z" fill={c} />
          <Path d="M0 46 Q20 38 32 46 T64 46" stroke={a} strokeWidth="1" fill="none" opacity="0.4" />
        </>
      );
    case 'compass':
    default:
      return (
        <>
          <Circle cx="32" cy="32" r="22" stroke={c} strokeWidth="2" fill="none" />
          <Polygon points="32,12 36,32 32,52 28,32" fill={a} />
          <Circle cx="32" cy="32" r="2" fill={c} />
        </>
      );
  }
}
