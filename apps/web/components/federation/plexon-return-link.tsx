"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MsqdxButton } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";
import {
  extractPlexonReturnToFromRedirect,
  normalizePlexonReturnTo,
  PLEXON_RETURN_TO_PARAM,
  PLEXON_RETURN_TO_STORAGE_KEY,
} from "../../lib/plexon-links";

function PlexonReturnLinkInner({
  compact = false,
  fullWidth = false,
}: {
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    const directReturnTo = normalizePlexonReturnTo(searchParams.get(PLEXON_RETURN_TO_PARAM));
    const redirectReturnTo = extractPlexonReturnToFromRedirect(searchParams.get("redirect"));
    const nextReturnTo = directReturnTo ?? redirectReturnTo;

    if (typeof window === "undefined") return;

    if (nextReturnTo) {
      window.sessionStorage.setItem(PLEXON_RETURN_TO_STORAGE_KEY, nextReturnTo);
      setReturnTo(nextReturnTo);
      return;
    }

    const stored = normalizePlexonReturnTo(window.sessionStorage.getItem(PLEXON_RETURN_TO_STORAGE_KEY));
    setReturnTo(stored);
  }, [searchParams]);

  if (!returnTo) return null;

  return (
    <MsqdxButton
      variant="outlined"
      fullWidth={fullWidth}
      onClick={() => window.location.assign(returnTo)}
      sx={
        compact
          ? {
              minHeight: 32,
              px: 1.5,
              whiteSpace: "nowrap",
            }
          : undefined
      }
    >
      {t("common.backToPlexon")}
    </MsqdxButton>
  );
}

export function PlexonReturnLink(props: { compact?: boolean; fullWidth?: boolean }) {
  return (
    <Suspense fallback={null}>
      <PlexonReturnLinkInner {...props} />
    </Suspense>
  );
}
