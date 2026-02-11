import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    {
        ignores: ["storybook-static/", "node_modules/", ".next/", "out/", "build/"],
    },
    ...compat.extends("next/core-web-vitals"),
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                React: "readonly",
                RequestInit: "readonly",
                HeadersInit: "readonly",
            },
        },
        rules: {
            "no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],
            "no-undef": "error"
        }
    }
];

export default eslintConfig;
