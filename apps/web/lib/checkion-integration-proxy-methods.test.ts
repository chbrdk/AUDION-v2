import { describe, expect, it } from "vitest";

import * as checkionIntegrationRoute from "../app/api/integrations/checkion/[[...path]]/route";

describe("checkion integration BFF proxy", () => {
  it("forwards PUT for CHECKION project linking (not only GET/POST)", () => {
    expect(typeof checkionIntegrationRoute.GET).toBe("function");
    expect(typeof checkionIntegrationRoute.POST).toBe("function");
    expect(typeof checkionIntegrationRoute.PUT).toBe("function");
    expect(typeof checkionIntegrationRoute.PATCH).toBe("function");
    expect(typeof checkionIntegrationRoute.DELETE).toBe("function");
  });
});
