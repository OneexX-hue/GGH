import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 21234,
    // Без этого занятый порт молча уводит Vite на 21235, а напечатанные адреса
    // и адрес на телефоне указывают в пустоту. Лучше упасть с понятной ошибкой.
    strictPort: true,
    // Прокси избавляет от CORS в разработке и позволяет собирать веб как SPA,
    // которая ходит на тот же origin. Мобильное приложение бьёт в API напрямую.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/health': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
