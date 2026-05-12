export function resolvePreferredProjectId(
  projectIds: string[],
  options: {
    launchProjectId?: string | null;
    activeProjectId?: string | null;
    cookieProjectId?: string | null;
    defaultProjectId?: string | null;
  }
): string | null {
  if (options.launchProjectId && projectIds.includes(options.launchProjectId)) {
    return options.launchProjectId;
  }
  if (options.activeProjectId && projectIds.includes(options.activeProjectId)) {
    return options.activeProjectId;
  }
  if (options.cookieProjectId && projectIds.includes(options.cookieProjectId)) {
    return options.cookieProjectId;
  }
  if (options.defaultProjectId && projectIds.includes(options.defaultProjectId)) {
    return options.defaultProjectId;
  }
  return null;
}
