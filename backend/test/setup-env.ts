// Выполняется до импорта тестовых файлов (jest "setupFiles") — гарантирует,
// что e2e-тесты никогда не подключатся к dev-базе, даже если DATABASE_URL
// уже задан в окружении. ROCKETCHAT_* сознательно не задаются — chat-bridge
// работает в режиме no-op provisioning (см. ChatBridgeService.isConfigured),
// e2e не поднимает Rocket.Chat.
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://carclub:carclub@localhost:5432/carclub_test?schema=public';
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.ROCKETCHAT_BASE_URL = '';
process.env.ROCKETCHAT_ADMIN_TOKEN = '';
process.env.ROCKETCHAT_ADMIN_USER_ID = '';
process.env.MEDIA_STORAGE_DIR = './storage-data-e2e';
process.env.MEDIA_ENCRYPTION_KEY = 'e2e-test-encryption-key';
