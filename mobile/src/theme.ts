import { MD3DarkTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';

// Единая палитра с web-admin (см. web-admin/app/globals.css) —
// перенесена из пользовательского "Secret Chat UI Kit" (docs/LICENSING.md,
// раздел "«Secret Chat UI Kit»"): глубокий сине-чёрный фон + мягкий
// голубой акцент, чтобы клиентское приложение и админ-панель считывались
// как один продукт.
export const colors = {
  primary: '#8ab7d8',
  onPrimary: '#061019',
  background: '#05090d',
  surface: '#080d12',
  surfaceVariant: '#0d141b',
  onSurface: '#f2f5f7',
  onSurfaceVariant: '#7f8993',
  outline: 'rgba(255,255,255,0.09)',
  error: '#e45f54',
  onError: '#1a0806',
  success: '#93bda2',
};

export const paperTheme = {
  ...MD3DarkTheme,
  roundness: 3, // Paper масштабирует roundness×4 ≈ 12px — совпадает с --radius-sm кита
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
