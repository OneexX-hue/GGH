import { MD3DarkTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';

// Единая палитра с web-admin (см. web-admin/app/globals.css) —
// монохромная чёрно-белая схема вместо прежнего амбер-акцента, чтобы
// клиентское приложение и админ-панель считывались как один продукт.
export const colors = {
  primary: '#f0f0ee',
  onPrimary: '#0a0a0b',
  background: '#0a0a0b',
  surface: '#131315',
  surfaceVariant: '#1c1c1f',
  onSurface: '#f0f0ee',
  onSurfaceVariant: '#87878a',
  outline: '#222225',
  error: '#d97a72',
  onError: '#1c0806',
};

export const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...colors,
  },
};

export const navigationTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.outline,
  },
};
