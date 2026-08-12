import { SvgXml } from 'react-native-svg';
import { AVATAR_GROUP, AVATAR_PORTRAIT, SINGLE_VARIANTS } from './avatar-art';

// Generic-плейсхолдер аватары — та же логика выбора, что и в
// web-admin/components/chat-avatar.tsx (детерминированный хэш от id,
// не привязка к демо-именам кита). См. docs/DECISIONS.md, «Перенос
// вёрстки Secret Chat UI Kit».
function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

interface Props {
  id: string;
  isGroup?: boolean;
  isLarge?: boolean;
  size?: number;
}

export function AvatarSilhouette({ id, isGroup = false, isLarge = false, size = 44 }: Props) {
  const xml = isLarge ? AVATAR_PORTRAIT : isGroup ? AVATAR_GROUP : SINGLE_VARIANTS[hashToIndex(id, SINGLE_VARIANTS.length)];
  return <SvgXml xml={xml} width={size} height={size} />;
}
