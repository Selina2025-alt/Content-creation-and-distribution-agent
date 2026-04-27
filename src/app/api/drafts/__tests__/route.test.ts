// @vitest-environment node

import { rmSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { DELETE, PATCH } from "@/app/api/drafts/[draftId]/route";
import { GET, POST } from "@/app/api/drafts/route";
import { migrateDatabase } from "@/lib/db/migrate";

process.env.CONTENT_CREATION_AGENT_DATA_ROOT = path.join(
  process.cwd(),
  ".codex-data-tests",
  "draft-routes"
);

describe("draft routes", () => {
  beforeEach(() => {
    rmSync(process.env.CONTENT_CREATION_AGENT_DATA_ROOT!, {
      recursive: true,
      force: true
    });

    migrateDatabase();
  });

  it("creates drafts, lists them, updates them, and deletes them", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: "智能体草稿",
          prompt: "写一篇关于智能体发展的文章",
          selectedPlatforms: ["wechat", "twitter"]
        })
      })
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const listResponse = await GET(new Request("http://localhost/api/drafts"));
    const drafts = (await listResponse.json()) as Array<{
      id: string;
      title: string;
      status: string;
    }>;

    expect(drafts[0]).toMatchObject({
      id: created.id,
      title: "智能体草稿",
      status: "draft"
    });

    const patchResponse = await PATCH(
      new Request(`http://localhost/api/drafts/${created.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: "智能体草稿 2",
          prompt: "写一篇关于 AI Agent 发展的文章",
          selectedPlatforms: ["wechat"]
        })
      }),
      { params: Promise.resolve({ draftId: created.id }) }
    );

    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toMatchObject({
      id: created.id,
      title: "智能体草稿 2",
      selectedPlatforms: ["wechat"]
    });

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/drafts/${created.id}`, {
        method: "DELETE"
      }),
      { params: Promise.resolve({ draftId: created.id }) }
    );

    expect(deleteResponse.status).toBe(200);
  });
});
