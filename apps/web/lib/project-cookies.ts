import { PROJECT_COOKIE_NAME } from "./auth-constants";

const COOKIE_MAX_AGE_DAYS = 30;

export const getProjectCookie = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${PROJECT_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(PROJECT_COOKIE_NAME.length + 1));
};

export const setProjectCookie = (projectId: string) => {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${PROJECT_COOKIE_NAME}=${encodeURIComponent(projectId)}; path=/; max-age=${maxAge}; samesite=lax`;
};

export const clearProjectCookie = () => {
  if (typeof document === "undefined") return;
  document.cookie = `${PROJECT_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
};
