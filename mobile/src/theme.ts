import { MD3DarkTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';

// Единая палитра с web-admin (см. web-admin/app/globals.css) —
// перенесена из пользовательского "Secret Chat UI Kit", актуальная
// версия из ветки claude/design-exact-copy-339e9w (src/css/tokens.css):
// графитово-чёрный фон с нейтральным (не синим) почти-белым акцентом,
// чтобы клиентское приложение и админ-панель считывались как один
// продукт.
export const colors = {
  primary: '#e8edf2',
  onPrimary: '#14171b',
  background: '#050506',
  surface: '#08090b',
  surfaceVariant: '#0b0d10',
  surfaceElevated: '#14181c',
  onSurface: '#f4f6f8',
  onSurfaceVariant: '#8e979f',
  outline: 'rgba(255,255,255,0.085)',
  error: '#e5483c',
  onError: '#1a0806',
  success: '#93bda2',
  bubbleOut: '#24272b',
  bubbleIn: '#202226',
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
