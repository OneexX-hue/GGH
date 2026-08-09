import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth-context';
import { NavBar } from './nav-bar';
import './globals.css';

export const metadata: Metadata = {
  title: 'CarClub Admin',
  description: 'Административная панель платформы автоклуба',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <div className="layout">
            <NavBar />
            <main className="content">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
