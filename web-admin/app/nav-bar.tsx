'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth-context';

export function NavBar() {
  const { token, logout } = useAuth();

  return (
    <nav className="nav">
      <div style={{ fontWeight: 600, marginBottom: 16 }}>CarClub Admin</div>
      {token ? (
        <>
          <Link href="/members">Участники</Link>
          <Link href="/invites">Приглашения</Link>
          <Link href="/roles">Роли</Link>
          <Link href="/moderation">Модерация</Link>
          <button onClick={logout} style={{ marginTop: 16 }}>
            Выйти
          </button>
        </>
      ) : (
        <Link href="/login">Войти</Link>
      )}
    </nav>
  );
}
