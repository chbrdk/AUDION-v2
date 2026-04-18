import { describe, expect, it } from "vitest";
import { parsePersonaGenerateForm } from "./persona-generate-api-body";

const projectId = "550e8400-e29b-41d4-a716-446655440000";

describe("parsePersonaGenerateForm", () => {
  it("requires segment and project_id", () => {
    const fd = new FormData();
    const r = parsePersonaGenerateForm(fd);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.segment).toBeDefined();
      expect(r.errors.project_id).toBeDefined();
    }
  });

  it("rejects invalid project_id", () => {
    const fd = new FormData();
    fd.set("segment", "Buyers");
    fd.set("project_id", "not-a-uuid");
    const r = parsePersonaGenerateForm(fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.project_id?.[0]).toMatch(/Invalid/);
  });

  it("builds PersonaGenerateRequest-shaped body", () => {
    const fd = new FormData();
    fd.set("segment", "  CFO  ");
    fd.set("project_id", projectId);
    const r = parsePersonaGenerateForm(fd);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toEqual({ project_id: projectId, segment: "CFO" });
    }
  });

  it("adds optional persona_id and output_locale", () => {
    const fd = new FormData();
    fd.set("segment", "x");
    fd.set("project_id", projectId);
    fd.set("persona_id", "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    fd.set("output_locale", "de");
    const r = parsePersonaGenerateForm(fd);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toEqual({
        project_id: projectId,
        segment: "x",
        persona_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        output_locale: "de",
      });
    }
  });
});
