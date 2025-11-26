"use client";

import type { ReactNode, CSSProperties } from "react";
import clsx from "clsx";
import { MaterialSymbol } from "../material-symbol";

export type DashboardCardVariant = 
  | "persona-basics" 
  | "bio" 
  | "personality" 
  | "pain-goals" 
  | "communication" 
  | "knowledge" 
  | "advanced";

export type UdgGlassDashboardCardProps = {
  id: string;
  title: string;
  icon: string;
  variant?: DashboardCardVariant;
  iconColor?: { background?: string; color: string };
  borderColor?: string;
  fullWidth?: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
};

export const UdgGlassDashboardCard = ({
  id,
  title,
  icon,
  variant,
  iconColor,
  borderColor,
  fullWidth = false,
  expanded,
  onToggle,
  children
}: UdgGlassDashboardCardProps) => {
  const handleToggle = () => {
    onToggle(id);
  };

  const handleButtonToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(id);
  };

  const cardClassName = clsx(
    "udg-glass-dashboard-card",
    variant && `--${variant}`,
    !expanded && "collapsed"
  );

  // Determine border color: use borderColor prop, or fallback to iconColor.color
  const effectiveBorderColor = borderColor || iconColor?.color;

  const cardStyle: CSSProperties = {
    ...(fullWidth ? { gridColumn: "1 / -1" } : {}),
    ...(effectiveBorderColor ? { border: `1px solid ${effectiveBorderColor}` } : {})
  };

  const headerStyle: CSSProperties = {
    ...(effectiveBorderColor ? { borderBottom: `1px solid ${effectiveBorderColor}` } : {})
  };

  return (
    <div className={cardClassName} style={cardStyle}>
      <div 
        className="udg-glass-dashboard-card-header"
        style={headerStyle}
        onClick={handleToggle}
      >
        <h3>
          <MaterialSymbol 
            icon={icon} 
            fontSize={20} 
            style={iconColor?.color ? { color: iconColor.color } : {}}
          />
          {title}
        </h3>
        <button 
          className={clsx(
            "udg-glass-dashboard-card-toggle",
            expanded && "--expanded"
          )}
          onClick={handleButtonToggle}
        >
          <MaterialSymbol icon="expand_more" fontSize={20} />
        </button>
      </div>
      {expanded && (
        <div className="udg-glass-dashboard-card-content">
          {children}
        </div>
      )}
    </div>
  );
};

