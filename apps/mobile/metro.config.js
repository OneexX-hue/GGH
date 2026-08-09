const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro в pnpm-монорепо.
 *
 * По умолчанию Metro смотрит только в свою папку и не находит ни исходники
 * из lib/*, ни жёсткие ссылки pnpm в корневом node_modules. Две настройки ниже
 * это чинят: watchFolders даёт доступ к коду пакетов, nodeModulesPaths — к их
 * зависимостям.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm раскладывает пакеты по симлинкам — без этого Metro их не пройдёт.
config.resolver.unstable_enableSymlinks = true;
// Иерархический поиск оставлен включённым намеренно: pnpm держит зависимости
// пакета рядом с ним в .pnpm/, и при отключённом поиске Metro до них не доходит —
// сборка падает на пакетах, которые expo-router подключает неявно.

module.exports = config;
