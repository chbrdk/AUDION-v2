import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

export type MaterialSymbolProps = {
  icon: string;
  fontSize?: CSSProperties["fontSize"];
  weight?: number;
  fill?: 0 | 1;
  grade?: number;
  opticalSize?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

export const MaterialSymbol = ({
  icon,
  fontSize = 24,
  weight = 200,
  fill = 0,
  grade = 0,
  opticalSize = 24,
  className,
  style,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden
}: MaterialSymbolProps): ReactNode => {
  // Normalize fontSize to ensure consistent rendering
  const normalizedFontSize = typeof fontSize === "number" ? `${fontSize}px` : fontSize;
  
  return (
    <span
      className={clsx("material-symbols-outlined", className)}
      style={{
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
        fontSize: normalizedFontSize,
        lineHeight: 1,
        color: "inherit",
        ...style
      }}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
    >
      {icon}
    </span>
  );
};

MaterialSymbol.displayName = "udg-glass-material-symbol";

