// Два прогона: business-логика (testEnvironment 'node', *.spec.ts) и
// точечный рендер критичных компонентов (testEnvironment 'jsdom',
// *.test.tsx, React Testing Library) — не 100% покрытие компонентов,
// а несколько новых взаимодействий из этого прохода (см. docs/ROADMAP.md).
const tsJestConfig = {
  tsconfig: {
    module: 'commonjs',
    moduleResolution: 'node',
    esModuleInterop: true,
    isolatedModules: true,
    skipLibCheck: true,
    jsx: 'react-jsx',
  },
};

module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testRegex: '.*\\.spec\\.ts$',
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: { '^.+\\.ts$': ['ts-jest', tsJestConfig] },
      testPathIgnorePatterns: ['/node_modules/', '/.next/'],
    },
    {
      displayName: 'components',
      testEnvironment: 'jsdom',
      testRegex: '.*\\.test\\.tsx$',
      moduleFileExtensions: ['tsx', 'ts', 'js', 'json'],
      transform: { '^.+\\.tsx?$': ['ts-jest', tsJestConfig] },
      testPathIgnorePatterns: ['/node_modules/', '/.next/'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};
