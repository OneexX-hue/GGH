import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../lib/auth-context';
import { ChatProvider } from '../lib/chat-context';
import { NavBar } from './nav-bar';
import './globals.css';

// next/font самостоятельно скачивает и хостит шрифт на этапе сборки —
// в браузере ни одного внешнего запроса к Google Fonts не уходит.
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CarClub Admin',
  description: 'Административная панель платформы автоклуба',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <AuthProvider>
          <ChatProvider>
            <div className="layout">
              <NavBar />
              <main className="content">{children}</main>
            </div>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
