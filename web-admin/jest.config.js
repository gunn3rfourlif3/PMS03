/**
 * Component tests for web-admin.
 *
 * Deliberately ts-jest rather than `next/jest`: the SWC native binding in
 * next/jest segfaults in some environments, and these specs need no Next
 * compiler features — only TSX, the `@/` alias and a DOM.
 */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/components/**/*.spec.tsx', '<rootDir>/lib/**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|scss)$': '<rootDir>/jest.style-stub.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true } }],
  },
};
