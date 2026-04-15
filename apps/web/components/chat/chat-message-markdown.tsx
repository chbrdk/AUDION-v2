"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { alpha, Box, Link, Typography, useTheme } from "@mui/material";

export type ChatMessageMarkdownProps = {
  content: string;
  /** Use body2 + slightly tighter spacing (e.g. target-group grid cards). */
  dense?: boolean;
};

/**
 * Renders chat message text as Markdown (**bold**, lists, links, code fences, etc.)
 * with MUI-typography styling consistent with chat bubbles.
 */
export function ChatMessageMarkdown({ content, dense = false }: ChatMessageMarkdownProps) {
  const theme = useTheme();
  const variant = dense ? "body2" : "body1";
  const codeBg = alpha(theme.palette.text.primary, 0.08);
  const preBg = alpha(theme.palette.text.primary, 0.06);

  const components: Components = {
    p: ({ children }) => (
      <Typography variant={variant} component="p" sx={{ m: 0, mb: dense ? 0.75 : 1, "&:last-child": { mb: 0 } }}>
        {children}
      </Typography>
    ),
    strong: ({ children }) => (
      <Box component="strong" sx={{ fontWeight: 700, color: "inherit" }}>
        {children}
      </Box>
    ),
    em: ({ children }) => (
      <Box component="em" sx={{ fontStyle: "italic", color: "inherit" }}>
        {children}
      </Box>
    ),
    ul: ({ children }) => (
      <Box
        component="ul"
        sx={{
          m: 0,
          mb: dense ? 0.75 : 1,
          pl: 2.25,
          listStyleType: "disc",
          "&:last-child": { mb: 0 },
        }}
      >
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box
        component="ol"
        sx={{
          m: 0,
          mb: dense ? 0.75 : 1,
          pl: 2.25,
          listStyleType: "decimal",
          "&:last-child": { mb: 0 },
        }}
      >
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Typography variant={variant} component="li" sx={{ display: "list-item", mb: 0.25 }}>
        {children}
      </Typography>
    ),
    a: ({ href, children }) => (
      <Link href={href ?? "#"} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ wordBreak: "break-word" }}>
        {children}
      </Link>
    ),
    code: ({ className, children, ...props }) => {
      // Inline `code` has no className; fenced blocks use language-* (or no class — then pre's & code overrides chip styles).
      if (!className) {
        return (
          <Box
            component="code"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.9em",
              backgroundColor: codeBg,
              px: 0.5,
              py: 0.125,
              borderRadius: 0.5,
            }}
            {...props}
          >
            {children}
          </Box>
        );
      }
      return (
        <Box component="code" className={className} sx={{ fontFamily: "monospace" }} {...props}>
          {children}
        </Box>
      );
    },
    pre: ({ children }) => (
      <Box
        component="pre"
        sx={{
          m: 0,
          mb: dense ? 0.75 : 1,
          p: 1.5,
          overflow: "auto",
          borderRadius: 1,
          backgroundColor: preBg,
          lineHeight: 1.5,
          "&:last-child": { mb: 0 },
          "& code": {
            fontFamily: "monospace",
            fontSize: dense ? "0.8125rem" : "0.875rem",
            display: "block",
            whiteSpace: "pre-wrap",
            backgroundColor: `${alpha(theme.palette.text.primary, 0)} !important`,
            padding: "0 !important",
          },
        }}
      >
        {children}
      </Box>
    ),
    blockquote: ({ children }) => (
      <Box
        component="blockquote"
        sx={{
          m: 0,
          mb: dense ? 0.75 : 1,
          pl: 1.5,
          borderLeft: `3px solid ${theme.palette.divider}`,
          color: "text.secondary",
          "&:last-child": { mb: 0 },
        }}
      >
        {children}
      </Box>
    ),
    h1: ({ children }) => (
      <Typography variant="h6" component="h1" sx={{ mt: 0.5, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography variant="subtitle1" component="h2" sx={{ mt: 0.5, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography variant="subtitle2" component="h3" sx={{ mt: 0.5, mb: 0.5, fontWeight: 600 }}>
        {children}
      </Typography>
    ),
    hr: () => <Box component="hr" sx={{ border: 0, borderTop: `1px solid ${theme.palette.divider}`, my: 1 }} />,
    del: ({ children }) => (
      <Box component="del" sx={{ textDecoration: "line-through", opacity: 0.88 }}>
        {children}
      </Box>
    ),
    img: ({ src, alt }) => (
      <Box
        component="img"
        src={src}
        alt={alt ?? ""}
        sx={{ maxWidth: "100%", height: "auto", borderRadius: 1, display: "block", my: 0.5 }}
      />
    ),
    table: ({ children }) => (
      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          my: 1,
          fontSize: dense ? "0.8125rem" : "0.875rem",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    ),
    thead: ({ children }) => <Box component="thead" sx={{ bgcolor: alpha(theme.palette.text.primary, 0.04) }}>{children}</Box>,
    tbody: ({ children }) => <Box component="tbody">{children}</Box>,
    tr: ({ children }) => (
      <Box component="tr" sx={{ borderBottom: `1px solid ${theme.palette.divider}`, "&:last-child": { borderBottom: "none" } }}>
        {children}
      </Box>
    ),
    th: ({ children }) => (
      <Box component="th" sx={{ textAlign: "left", p: 1, fontWeight: 600, verticalAlign: "top" }}>
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box component="td" sx={{ p: 1, verticalAlign: "top" }}>
        {children}
      </Box>
    ),
  };

  return (
    <Box sx={{ color: "inherit" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}
