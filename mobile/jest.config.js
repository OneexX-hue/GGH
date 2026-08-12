// Точечные unit-тесты чистой TS-логики (media-маркеры, REST-клиент) —
// не полный jest-expo/React Native Testing Library стек для рендера
// экранов, это вне объёма этого прохода. Файлы без RN-импортов можно
// тестировать в обычном node-окружении через ts-jest.
module.exports = {
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  testPathIgnorePatterns: ['/node_modules/'],
};
