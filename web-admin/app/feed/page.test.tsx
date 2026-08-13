import { render, screen, waitFor } from '@testing-library/react';
import FeedPage from './page';
import { AuthProvider } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

const mockReplace = jest.fn();
// Стабильная ссылка на объект router — реальный useRouter() из
// next/navigation мемоизирован (одна и та же ссылка между рендерами),
// а FeedPage держит router в зависимостях эффекта; литерал объекта
// на каждый вызов сломал бы это и вызвал бы effect в бесконечном цикле.
const mockRouterObj = { replace: mockReplace };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouterObj,
}));

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

describe('FeedPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    (apiFetch as jest.Mock).mockReset();
    localStorage.setItem('carclub_admin_token', 'a-token');
    localStorage.setItem('carclub_admin_refresh_token', 'r-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('рендерит события ленты из всех модулей, отсортированные с сервера', async () => {
    (apiFetch as jest.Mock).mockResolvedValueOnce([
      {
        id: 'e1',
        moduleKey: 'auto-quest',
        points: 10,
        reason: 'Найден автомобиль',
        occurredAt: '2026-08-13T10:00:00.000Z',
        user: { id: 'u1', displayName: 'Иван Петров' },
      },
      {
        id: 'e2',
        moduleKey: 'hide-and-seek',
        points: 5,
        reason: 'Раунд завершён',
        occurredAt: '2026-08-13T09:00:00.000Z',
        user: { id: 'u2', displayName: 'Анна Сидорова' },
      },
    ]);

    render(
      <AuthProvider>
        <FeedPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('Анна Сидорова')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/modules/feed/recent?skip=0&take=30', { token: 'a-token' });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('показывает "Событий пока нет" при пустой ленте', async () => {
    (apiFetch as jest.Mock).mockResolvedValueOnce([]);

    render(
      <AuthProvider>
        <FeedPage />
      </AuthProvider>,
    );

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(await screen.findByText('Событий пока нет')).toBeInTheDocument();
  });
});
