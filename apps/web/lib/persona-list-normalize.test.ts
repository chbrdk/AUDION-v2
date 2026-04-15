import { describe, expect, it } from "vitest";
import { normalizePersonaListItem, normalizePersonaListResponse } from "./persona-list-normalize";

describe("normalizePersonaListItem", () => {
  it("maps camelCase fields", () => {
    const item = normalizePersonaListItem({
      id: "p1",
      projectId: "proj",
      targetGroupId: "tg1",
      name: "N",
      segment: "S",
      headline: "H",
      status: "draft",
      confidence: 0.42,
      version: "1",
      updatedAt: "2024-01-01",
      updatedBy: "u1",
      imageUrl: "https://x",
      avatarUrl: "https://a",
    });
    expect(item).toMatchObject({
      id: "p1",
      projectId: "proj",
      targetGroupId: "tg1",
      confidence: 0.42,
      updatedAt: "2024-01-01",
    });
  });

  it("maps snake_case aliases and profile.targetGroupId", () => {
    const item = normalizePersonaListItem({
      id: "p1",
      project_id: "proj2",
      name: "N",
      segment: "S",
      headline: "H",
      status: "draft",
      confidence: 0.5,
      version: "1",
      updated_at: "2024-02-02",
      profile: { target_group_id: "tg-nested" },
    });
    expect(item.projectId).toBe("proj2");
    expect(item.targetGroupId).toBe("tg-nested");
    expect(item.updatedAt).toBe("2024-02-02");
  });

  it("prefers top-level target group over profile", () => {
    const item = normalizePersonaListItem({
      id: "p1",
      projectId: "p",
      targetGroupId: "tg-top",
      name: "N",
      segment: "S",
      headline: "H",
      status: "draft",
      confidence: 0,
      version: "1",
      profile: { targetGroupId: "tg-nested" },
    });
    expect(item.targetGroupId).toBe("tg-top");
  });
});

describe("normalizePersonaListResponse", () => {
  it("normalizes items and reads page_size or pageSize", () => {
    const res = normalizePersonaListResponse({
      items: [{ id: "a", project_id: "x", name: "", segment: "", headline: "", status: "", confidence: 0, version: "", updated_at: null }],
      total: 3,
      page: 2,
      pageSize: 25,
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].projectId).toBe("x");
    expect(res).toMatchObject({ total: 3, page: 2, page_size: 25 });
  });
});
