import type { StorybookConfig } from '@storybook/nextjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  webpackFinal: async (config) => {
    // Resolve @msqdx/tokens so symlinked @msqdx/react can find it (use Node resolution from app context)
    let tokensPath: string;
    try {
      const entry = require.resolve('@msqdx/tokens');
      tokensPath = path.dirname(path.dirname(entry)); // package root (parent of dist/)
    } catch {
      tokensPath = path.resolve(__dirname, '../../../node_modules/@msqdx/tokens');
    }
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@msqdx/tokens': tokensPath,
    };
    return config;
  },
};

export default config;
