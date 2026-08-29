import { Link } from 'wouter';

export function NotFound() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-black text-slate-700">404</p>
      <h1 className="text-xl font-semibold">Такой страницы нет</h1>
      <Link href="/" className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-slate-900">
        На главную
      </Link>
    </main>
  );
}
