import type { PublishStatus } from "@/lib/types";

export async function mockPublishContent(): Promise<{
  status: PublishStatus;
  message: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 150));

  return {
    status: "published",
    message: "发布成功"
  };
}
