import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("target group delete and archive", () => {
  it("exposes deleteTargetGroup in api client", () => {
    const source = readFileSync(join(webRoot, "app/api/_lib/target-group.ts"), "utf8");
    expect(source).toContain("export async function deleteTargetGroup");
    expect(source).toContain('method: "DELETE"');
  });

  it("forwards DELETE in next route", () => {
    const route = readFileSync(
      join(webRoot, "app/api/target-groups/[targetGroupId]/route.ts"),
      "utf8"
    );
    expect(route).toContain("export async function DELETE");
  });

  it("wires archive, restore and delete actions in admin panel", () => {
    const panel = readFileSync(
      join(webRoot, "components/msqdx-glass-target-group-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("handleArchive");
    expect(panel).toContain("handleRestore");
    expect(panel).toContain("handleDeleteConfirm");
    expect(panel).toContain("deleteTargetGroup");
    expect(panel).toContain("TARGET_GROUP_LIFECYCLE.archived");
    expect(panel).toContain("targetGroupsAdmin.deleteDialogTitle");
  });
});
