import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { AuthProvider } from '../../lib/auth-context';
import { apiFetch } from '../../lib/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
const mockPush = jest.fn();

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (apiFetch as jest.Mock).mockReset();
    localStorage.clear();
  });

  it('отправляет identifier/password и переходит на /members при успехе', async () => {
    (apiFetch as jest.Mock).mockResolvedValueOnce({ accessToken: 'a-token', refreshToken: 'r-token' });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Email \/ телефон/i), { target: { value: 'owner@carclub.local' } });
    fireEvent.change(screen.getByLabelText(/Пароль/i), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Войти/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/members'));

    expect(apiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { identifier: 'owner@carclub.local', password: 'password-123', totpCode: undefined },
    });
  });

  it('показывает сообщение об ошибке при неверных данных, не переходя на /members', async () => {
    (apiFetch as jest.Mock).mockRejectedValueOnce(new Error('Неверный email/телефон или пароль'));

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Email \/ телефон/i), { target: { value: 'owner@carclub.local' } });
    fireEvent.change(screen.getByLabelText(/Пароль/i), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Войти/i }));

    await waitFor(() => expect(screen.getByText(/Не удалось войти/i)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
