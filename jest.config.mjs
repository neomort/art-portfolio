/** @type {import('jest').Config} */
const config = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  setupFiles: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__mocks__/lib/env.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/lib/env$': '<rootDir>/src/__mocks__/lib/env.ts',
    '^@stripe/stripe-js$': '<rootDir>/src/__mocks__/stripe-js.ts',
  },
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: ['node', 'node-addons'],
  },
  moduleDirectories: ['node_modules', 'src'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
      plugins: [
        ['@babel/plugin-transform-runtime', { regenerator: true, useESModules: false }],
        ['babel-plugin-transform-import-meta', { module: 'ES6' }],
        ['@babel/plugin-transform-modules-commonjs'],
      ],
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(flowbite|react-leaflet|@react-leaflet|@stripe|lucide-react|@stripe/stripe-js|@stripe/react-stripe-js|node-fetch|fetch-blob|formdata-polyfill|@react-hook/)/)',
  ],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Ignore Supabase edge function directories (Deno env / npm: specifiers)
  testPathIgnorePatterns: ['<rootDir>/supabase/', '<rootDir>/tests/'],
  modulePathIgnorePatterns: ['<rootDir>/supabase/', '<rootDir>/tests/'],
  // Only pick unit tests, not helpers
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/src/__tests__/**/*.spec.(ts|tsx|js|jsx)'
  ],
};

export default config;
