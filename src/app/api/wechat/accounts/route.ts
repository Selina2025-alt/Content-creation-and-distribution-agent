import { NextResponse } from "next/server";

import {
  WechatOpenApiError,
  listWechatAccounts
} from "@/lib/publish/wechat-openapi-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await listWechatAccounts();

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WechatOpenApiError) {
      return NextResponse.json(
        {
          code: error.code,
          detail: error.detail,
          message: error.message
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch wechat accounts"
      },
      { status: 500 }
    );
  }
}
