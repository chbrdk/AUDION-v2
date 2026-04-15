/**
 * Maps raw field-definition group keys to i18n paths for section headings.
 */
export function entityFieldGroupTitleKey(groupKey: string): string {
  switch (groupKey) {
    case "demographics":
      return "personaAdmin.demographics";
    case "metadata":
      return "personaAdmin.metadata";
    case "basic":
      return "entityFieldGroups.basic";
    case "other":
      return "entityFieldGroups.other";
    default:
      return `entityFieldGroups.${groupKey}`;
  }
}
