// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/wechat/accounts/route";

const originalWechatOpenApiKey = process.env.WECHAT_OPENAPI_KEY;
const originalWechatOpenApiBaseUrl = process.env.WECHAT_OPENAPI_BASE_URL;

describe("wechat accounts route", () => {
  afterEach(() => {
    process.env.WECHAT_OPENAPI_KEY = originalWechatOpenApiKey;
    process.env.WECHAT_OPENAPI_BASE_URL = originalWechatOpenApiBaseUrl;
    vi.restoreAllMocks();
  });

  it("returns 503 when WECHAT_OPENAPI_KEY is missing", async () => {
    delete process.env.WECHAT_OPENAPI_KEY;

    const response = await POST(
      new Request("http://localhost/api/wechat/accounts", {
        method: "POST"
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "WECHAT_OPENAPI_NOT_CONFIGURED"
    });
  });

  it("returns normalized account data from WeChat OpenAPI", async () => {
    process.env.WECHAT_OPENAPI_KEY = "wechat-key";
    process.env.WECHAT_OPENAPI_BASE_URL = "https://wx.limyai.com/api/openapi";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accounts: [
            {
              avatar: "https://example.com/avatar.png",
              createdAt: "2024-01-01T00:00:00.000Z",
              lastAuthTime: "2024-01-01T00:00:00.000Z",
              name: "测试公众号",
              status: "active",
              type: "subscription",
              username: "gh_abc123",
              verified: true,
              wechatAppid: "wx123456"
            }
          ],
          total: 1
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/wechat/accounts", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accounts: [
        expect.objectContaining({
          name: "测试公众号",
          wechatAppid: "wx123456"
        })
      ],
      total: 1
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://wx.limyai.com/api/openapi/wechat-accounts",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "wechat-key"
        }),
        method: "POST"
      })
    );
  });
});
