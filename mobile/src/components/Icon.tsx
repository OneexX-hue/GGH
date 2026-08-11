// Иконки из пользовательского "Secret Chat UI Kit" (docs/LICENSING.md,
// раздел "«Secret Chat UI Kit»") — перенесены на react-native-svg (та же
// path-геометрия, что и в web-версии кита, web/components/icons.tsx).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'bell-off'
  | 'bell'
  | 'devices'
  | 'file'
  | 'folder'
  | 'lock'
  | 'mask'
  | 'mic'
  | 'more'
  | 'paperclip'
  | 'phone'
  | 'pin'
  | 'plus'
  | 'search'
  | 'settings'
  | 'shield-lock'
  | 'sliders'
  | 'star'
  | 'timer'
  | 'trash'
  | 'video'
  | 'x';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

const SHAPES: Record<IconName, (color: string) => React.ReactNode> = {
  'bell-off': (c) => <Path key="p" stroke={c} d="M6 8a6 6 0 0 1 9.8-4.6M18 8v4l2 3H9M10 19h4M3 3l18 18" />,
  bell: (c) => <Path key="p" stroke={c} d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9ZM10 20h4" />,
  devices: (c) => (
    <>
      <Rect key="r1" stroke={c} x="3" y="4" width="13" height="12" rx="2" />
      <Rect key="r2" stroke={c} x="14" y="10" width="7" height="11" rx="2" />
      <Path key="p" stroke={c} d="M7 19h4" />
    </>
  ),
  file: (c) => (
    <>
      <Path key="p1" stroke={c} d="M7 3h7l4 4v14H7z" />
      <Path key="p2" stroke={c} d="M14 3v5h5M10 13h5M10 17h5" />
    </>
  ),
  folder: (c) => <Path key="p" stroke={c} d="M3 6h7l2 2h9v11H3z" />,
  lock: (c) => (
    <>
      <Rect key="r" stroke={c} x="7" y="10" width="10" height="9" rx="2" />
      <Path key="p" stroke={c} d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  mask: (c) => (
    <>
      <Path key="p1" stroke={c} d="M4 8c5-3 11-3 16 0l-2 8c-4 4-8 4-12 0L4 8Z" />
      <Path key="p2" stroke={c} d="M7 12c1.5-1 3-1 4 0M13 12c1.5-1 3-1 4 0" />
    </>
  ),
  mic: (c) => (
    <>
      <Rect key="r" stroke={c} x="9" y="3" width="6" height="12" rx="3" />
      <Path key="p" stroke={c} d="M6 12a6 6 0 0 0 12 0M12 18v3" />
    </>
  ),
  more: (c) => (
    <>
      <Circle key="c1" stroke={c} cx="12" cy="5" r="1" />
      <Circle key="c2" stroke={c} cx="12" cy="12" r="1" />
      <Circle key="c3" stroke={c} cx="12" cy="19" r="1" />
    </>
  ),
  paperclip: (c) => <Path key="p" stroke={c} d="m9 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8" />,
  phone: (c) => <Path key="p" stroke={c} d="M7 4 4 6c.5 6.5 7 13 13.5 13.5l2-3-4-2-1.5 2c-3-1-5.5-3.5-6.5-6.5l2-1.5L7 4Z" />,
  pin: (c) => <Path key="p" stroke={c} d="m9 4 6 0 0 5 3 3-5 1-1 7-1-7-5-1 3-3z" />,
  plus: (c) => <Path key="p" stroke={c} d="M12 5v14M5 12h14" />,
  search: (c) => (
    <>
      <Circle key="c" stroke={c} cx="11" cy="11" r="6" />
      <Path key="p" stroke={c} d="m16 16 4 4" />
    </>
  ),
  settings: (c) => (
    <>
      <Circle key="c" stroke={c} cx="12" cy="12" r="3" />
      <Path
        key="p"
        stroke={c}
        d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z"
      />
    </>
  ),
  'shield-lock': (c) => (
    <>
      <Path key="p1" stroke={c} d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z" />
      <Rect key="r" stroke={c} x="9" y="10" width="6" height="5" rx="1" />
      <Path key="p2" stroke={c} d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10" />
    </>
  ),
  sliders: (c) => <Path key="p" stroke={c} d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" />,
  star: (c) => <Path key="p" stroke={c} d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" />,
  timer: (c) => (
    <>
      <Circle key="c" stroke={c} cx="12" cy="13" r="8" />
      <Path key="p" stroke={c} d="M12 13V8M9 3h6M12 5V3" />
    </>
  ),
  trash: (c) => <Path key="p" stroke={c} d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />,
  video: (c) => (
    <>
      <Rect key="r" stroke={c} x="3" y="6" width="12" height="12" rx="2" />
      <Path key="p" stroke={c} d="m15 10 6-3v10l-6-3" />
    </>
  ),
  x: (c) => <Path key="p" stroke={c} d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({ name, size = 20, color = '#F2F5F7' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {SHAPES[name](color)}
    </Svg>
  );
}
