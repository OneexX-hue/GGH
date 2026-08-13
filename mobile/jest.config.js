// Два прогона: business-логика (testEnvironment 'node', ts-jest,
// *.spec.ts — media-маркеры, REST-клиент) и точечный рендер критичных
// RN-компонентов (jest-expo preset, *.test.tsx, React Testing Library) —
// не полное покрытие экранов, а несколько новых взаимодействий из
// этого прохода (см. docs/ROADMAP.md).
module.exports = {
  projects: [
    {
      displayName: 'unit',
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
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
    },
  ],
};
