import { describe, it, expect } from "vitest";

import en from "../locales/en.json";
import de from "../locales/de.json";

describe("target group relevance i18n labels", () => {
  it("english uses deterministic and AI wording in both namespaces", () => {
    expect(en.targetGroupsAdmin.relevanceDet).toBe("Relevance (deterministic)");
    expect(en.targetGroupsAdmin.relevanceLlm).toBe("Relevance (AI)");
    expect(en.settingsProjects.companyContext.relevanceDet).toBe("Relevance (deterministic)");
    expect(en.settingsProjects.companyContext.relevanceLlm).toBe("Relevance (AI)");
  });

  it("german uses deterministisch and KI wording in both namespaces", () => {
    expect(de.targetGroupsAdmin.relevanceDet).toBe("Relevanz (deterministisch)");
    expect(de.targetGroupsAdmin.relevanceLlm).toBe("Relevanz (KI)");
    expect(de.settingsProjects.companyContext.relevanceDet).toBe("Relevanz (deterministisch)");
    expect(de.settingsProjects.companyContext.relevanceLlm).toBe("Relevanz (KI)");
  });
});
