"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApiDocsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new settings location
    router.replace("/admin/settings/api-docs");
  }, [router]);

  return null;
}

