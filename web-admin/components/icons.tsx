// Иконки из пользовательского "Secret Chat UI Kit" (docs/LICENSING.md,
// раздел "«Secret Chat UI Kit»") — перенесены как inline-SVG, stroke
// заменён на currentColor, чтобы цвет наследовался от окружающего текста
// (в оригинальном ките был захардкожен как #B8C0C8).

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BellOffIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 8a6 6 0 0 1 9.8-4.6M18 8v4l2 3H9M10 19h4M3 3l18 18" />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9ZM10 20h4" />
    </Base>
  );
}

export function DevicesIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="13" height="12" rx="2" />
      <rect x="14" y="10" width="7" height="11" rx="2" />
      <path d="M7 19h4" />
    </Base>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h5M10 17h5" />
    </Base>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 6h7l2 2h9v11H3z" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="10" width="10" height="9" rx="2" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </Base>
  );
}

export function MaskIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8c5-3 11-3 16 0l-2 8c-4 4-8 4-12 0L4 8Z" />
      <path d="M7 12c1.5-1 3-1 4 0M13 12c1.5-1 3-1 4 0" />
    </Base>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M6 12a6 6 0 0 0 12 0M12 18v3" />
    </Base>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </Base>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8" />
    </Base>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4 4 6c.5 6.5 7 13 13.5 13.5l2-3-4-2-1.5 2c-3-1-5.5-3.5-6.5-6.5l2-1.5L7 4Z" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 4 6 0 0 5 3 3-5 1-1 7-1-7-5-1 3-3z" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Base>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.7 1l.4 3h5l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" />
    </Base>
  );
}

export function ShieldLockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z" />
      <rect x="9" y="10" width="6" height="5" rx="1" />
      <path d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10" />
    </Base>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" />
    </Base>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9L12 3Z" />
    </Base>
  );
}

export function TimerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V8M9 3h6M12 5V3" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </Base>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </Base>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}
