import { describe, expect, it } from "vitest";
import { entityFieldGroupTitleKey } from "./entity-field-i18n";

describe("entityFieldGroupTitleKey", () => {
  it("maps known groups to stable i18n paths", () => {
    expect(entityFieldGroupTitleKey("demographics")).toBe("personaAdmin.demographics");
    expect(entityFieldGroupTitleKey("metadata")).toBe("personaAdmin.metadata");
    expect(entityFieldGroupTitleKey("basic")).toBe("entityFieldGroups.basic");
    expect(entityFieldGroupTitleKey("custom")).toBe("entityFieldGroups.custom");
  });
});
