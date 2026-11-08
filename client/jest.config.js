module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/__mocks__/lucide-react-native.js',
    '^.+/services/careReminders$': '<rootDir>/src/services/careReminders.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-documents/picker|react-native-file-access)/)',
  ],
};
