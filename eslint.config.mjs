import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Vue
    'vue/multi-word-component-names': 'off', // Nuxt gère les noms de pages
    'vue/no-v-html': 'warn',

    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // Général
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
})
