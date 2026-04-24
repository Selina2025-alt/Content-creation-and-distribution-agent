import { describe, expect, it } from "vitest";

import { toUserFacingError } from "@/lib/content/error-feedback";

describe("toUserFacingError", () => {
  it("maps balance errors", () => {
    const mapped = toUserFacingError(
      new Error("SiliconFlow request failed with 402: insufficient balance")
    );

    expect(mapped.code).toBe("balance_insufficient");
    expect(mapped.retryable).toBe(false);
  });

  it("maps timeout errors", () => {
    const mapped = toUserFacingError(
      new Error("SiliconFlow request timed out after 180000ms")
    );

    expect(mapped.code).toBe("model_timeout");
  });

  it("maps image generation errors", () => {
    const mapped = toUserFacingError(new Error("Failed to regenerate Xiaohongshu image"));

    expect(mapped.code).toBe("image_generation_failed");
  });
});
