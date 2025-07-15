/**
 * ESLint Security Configuration
 * 
 * Enhanced ESLint configuration focused on security best practices
 * and vulnerability prevention for the Open Search MCP project.
 */

module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking'
  ],
  plugins: [
    'security',
    '@typescript-eslint',
    'no-secrets'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Security-focused rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-no-csrf-before-method-override': 'error',

    // Secrets detection
    'no-secrets/no-secrets': ['error', {
      'tolerance': 4.2,
      'additionalRegexes': {
        'API Key': 'api[_-]?key[\'\"\\s]*[=:][\'\"\\s]*[a-zA-Z0-9]{16,}',
        'JWT Token': 'eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*',
        'Private Key': '-----BEGIN [A-Z ]*PRIVATE KEY-----',
        'Google API Key': 'AIza[0-9A-Za-z_-]{35}',
        'GitHub Token': 'ghp_[0-9A-Za-z]{36}',
        'Slack Token': 'xoxb-[0-9A-Za-z-]{50,}'
      }
    }],

    // TypeScript security rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Input validation and sanitization
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-restricted-globals': ['error', 'eval', 'execScript'],

    // Prevent dangerous patterns
    'no-restricted-syntax': [
      'error',
      {
        'selector': 'CallExpression[callee.name="eval"]',
        'message': 'eval() is dangerous and should not be used'
      },
      {
        'selector': 'CallExpression[callee.object.name="JSON"][callee.property.name="parse"]',
        'message': 'Use JSON.parse() with try-catch for error handling'
      },
      {
        'selector': 'CallExpression[callee.name="setTimeout"][arguments.0.type="Literal"]',
        'message': 'setTimeout with string argument is dangerous'
      },
      {
        'selector': 'CallExpression[callee.name="setInterval"][arguments.0.type="Literal"]',
        'message': 'setInterval with string argument is dangerous'
      }
    ],

    // Require proper error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',

    // Prevent information disclosure
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',

    // Enforce secure coding practices
    'strict': ['error', 'never'], // Use ES modules instead
    'no-with': 'error',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-global-assign': 'error',
    'no-implicit-globals': 'error',

    // Prevent prototype pollution
    'no-prototype-builtins': 'error',

    // Require proper input validation
    'valid-typeof': 'error',
    'use-isnan': 'error',
    'no-compare-neg-zero': 'error',

    // Prevent timing attacks
    'no-constant-condition': 'error',
    'no-unreachable': 'error',

    // File system security
    'no-path-concat': 'error',

    // Regular expression security
    'no-invalid-regexp': 'error',
    'no-regex-spaces': 'error',

    // Prevent XSS
    'no-inner-declarations': 'error',

    // Database security (if applicable)
    'no-restricted-properties': [
      'error',
      {
        'object': 'db',
        'property': 'query',
        'message': 'Use parameterized queries to prevent SQL injection'
      }
    ],

    // Custom security rules for this project
    'no-restricted-imports': [
      'error',
      {
        'patterns': [
          {
            'group': ['child_process'],
            'message': 'Use secure alternatives to child_process or ensure proper input validation'
          },
          {
            'group': ['vm'],
            'message': 'VM module can be dangerous, ensure proper sandboxing'
          }
        ]
      }
    ]
  },
  overrides: [
    {
      // Relaxed rules for test files
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      // Relaxed rules for configuration files
      files: ['**/*.config.js', '**/*.config.ts', '**/scripts/**/*.js'],
      rules: {
        'security/detect-child-process': 'off',
        'no-console': 'off'
      }
    },
    {
      // Strict rules for API and security-critical files
      files: ['**/src/config/**/*.ts', '**/src/utils/**/*.ts', '**/src/middleware/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        'security/detect-object-injection': 'error',
        'no-secrets/no-secrets': 'error'
      }
    }
  ],
  settings: {
    'import/resolver': {
      'typescript': {
        'alwaysTryTypes': true,
        'project': './tsconfig.json'
      }
    }
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.min.js',
    'coverage/',
    '.nyc_output/',
    'docs/',
    'deployment/',
    '*.d.ts'
  ]
};
