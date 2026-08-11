import { MD3DarkTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';

// Единая палитра с web-admin (см. web-admin/app/globals.css) — тот же
// амбер-акцент и асфальтовый тёмный фон, чтобы клиентское приложение и
// админ-панель считывались как один продукт.
const colors = {
  primary: '#e8a33d',
  onPrimary: '#1a1206',
  background: '#121316',
  surface: '#1a1c20',
  surfaceVariant: '#212327',
  onSurface: '#e8e6e1',
  onSurfaceVariant: '#9a9691',
  outline: '#2a2d33',
  error: '#e5766b',
  onError: '#200a08',
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
