// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // lucide-react-native uses the package.json "exports" field which the
      // node resolver in eslint-config-expo cannot handle for .tsx files.
      // TypeScript already validates these imports via tsc, so this is safe.
      'import/no-unresolved': ['error', { ignore: ['lucide-react-native'] }],
    },
  },
]);
