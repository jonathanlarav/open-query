import type { Config } from 'tailwindcss';
import baseConfig from '@open-query/config/tailwind';
import animate from 'tailwindcss-animate';

const config: Config = {
  ...baseConfig,
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  plugins: [animate],
} as Config;

export default config;
