// Generic-плейсхолдер аватары — силуэты из Secret Chat UI Kit
// (docs/LICENSING.md, «Secret Chat UI Kit»), выбираются детерминированно
// по id участника/комнаты, а не привязаны к конкретным демо-именам кита
// (Алексей/Елена/Дмитрий были просто примерами разметки, не персонами).
// См. docs/DECISIONS.md, «Перенос вёрстки Secret Chat UI Kit».

const SINGLE_VARIANTS = ['alexey', 'elena', 'dmitry'];

function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

export function avatarVariantFor(id: string, isGroup: boolean): string {
  if (isGroup) return 'group';
  return SINGLE_VARIANTS[hashToIndex(id, SINGLE_VARIANTS.length)];
}

interface ChatAvatarProps {
  id: string;
  isGroup?: boolean;
  size?: number;
  className?: string;
}

export function ChatAvatar({ id, isGroup = false, size = 38, className }: ChatAvatarProps) {
  const variant = avatarVariantFor(id, isGroup);
  return (
    <img
      src={`/chat-kit/avatars/${variant}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: '50%', flex: 'none' }}
    />
  );
}
