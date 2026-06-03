const STORAGE_KEY = "audion-target-groups-show-archived";

export function readTargetGroupsShowArchived(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTargetGroupsShowArchived(show: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
