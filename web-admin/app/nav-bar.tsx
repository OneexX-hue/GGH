'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { ShieldLockIcon, LockIcon } from '../components/icons';

const NAV_ITEMS = [
  { href: '/members', label: 'Участники', icon: '👥' },
  { href: '/invites', label: 'Приглашения', icon: '✉️' },
  { href: '/applications', label: 'Заявки', icon: '📝' },
  { href: '/roles', label: 'Роли', icon: '🛡️' },
  { href: '/modules', label: 'Модули', icon: '🧩' },
  { href: '/quests', label: 'Квесты', icon: '🗺️' },
  { href: '/hide-and-seek', label: 'Прятки', icon: '🙈' },
  { href: '/lpr', label: 'Номера', icon: '🚘' },
  { href: '/moderation', label: 'Модерация', icon: '💬' },
  { href: '/security', label: 'Безопасность', icon: <ShieldLockIcon size={16} /> },
];

export function NavBar() {
  const { token, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="nav">
      <div className="nav-brand">
        <ShieldLockIcon size={20} />
        <span>CarClub Admin</span>
      </div>
      {token ? (
        <>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : undefined}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <button className="btn-outline" style={{ marginTop: 18 }} onClick={logout}>
            Выйти
          </button>
        </>
      ) : (
        <Link href="/login">
          <LockIcon size={16} />
          <span>Войти</span>
        </Link>
      )}
    </nav>
  );
}
