import type { Preview } from '@storybook/react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { MSQDX_COLORS, MSQDX_THEME } from '@msqdx/tokens';
import React from 'react';

// Material Symbols font – load in story iframe when in browser
if (typeof document !== 'undefined' && document.head && !document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,100..700,0..1,-50..200';
  document.head.appendChild(link);
}

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: MSQDX_COLORS.brand.green,
    },
    secondary: {
      main: MSQDX_COLORS.brand.yellow,
    },
    background: {
      default: MSQDX_THEME.light.background.primary,
      paper: MSQDX_THEME.light.surface.primary,
    },
    text: {
      primary: MSQDX_THEME.light.text.primary,
      secondary: MSQDX_THEME.light.text.secondary,
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: MSQDX_COLORS.brand.green,
    },
    secondary: {
      main: MSQDX_COLORS.brand.yellow,
    },
    background: {
      default: MSQDX_THEME.dark.background.primary,
      paper: MSQDX_THEME.dark.surface.primary,
    },
    text: {
      primary: MSQDX_THEME.dark.text.primary,
      secondary: MSQDX_THEME.dark.text.secondary,
    },
  },
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: MSQDX_THEME.light.background.primary,
        },
        {
          name: 'dark',
          value: MSQDX_THEME.dark.background.primary,
        },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? darkTheme : lightTheme;
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <style>{`
            .msqdx-material-symbol, .material-symbols-outlined {
              font-family: 'Material Symbols Outlined', sans-serif !important;
              font-weight: normal;
              font-style: normal;
              font-size: 24px;
              line-height: 1;
              letter-spacing: normal;
              text-transform: none;
              display: inline-block;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
              font-feature-settings: 'liga';
              vertical-align: middle;
              color: currentColor;
            }
          `}</style>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
