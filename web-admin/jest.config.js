// Точечные unit-тесты бизнес-логики (не рендер компонентов — для этого
// потребовался бы отдельный jsdom + React Testing Library стек, вне
// объёма этого прохода). testEnvironment: 'node' достаточно для чистых
// TS-модулей (API-клиенты, утилиты).
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
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};
