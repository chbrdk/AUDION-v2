"use client";

import { MaterialSymbol } from "../material-symbol";

type Props = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export const UdgGlassAiFieldButton = ({ onClick, loading = false, disabled = false }: Props) => {
  return (
    <button
      type="button"
      className="udg-glass-ai-field-button"
      onClick={onClick}
      disabled={disabled || loading}
      title="AI Vorschlag"
      aria-label="AI Vorschlag"
    >
      <MaterialSymbol icon={loading ? "hourglass_empty" : "auto_awesome"} fontSize={14} />
    </button>
  );
};

