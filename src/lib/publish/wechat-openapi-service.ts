import type { PublishStatus } from "@/lib/types";

const DEFAULT_WECHAT_OPENAPI_BASE_URL = "https://wx.limyai.com/api/openapi";

export type WechatArticleType = "news" | "newspic";
export type WechatContentFormat = "markdown" | "html";

export interface WechatAccount {
  name: string;
  wechatAppid: string;
  username?: string;
  avatar?: string;
  type?: string;
  verified?: boolean;
  status?: string;
  lastAuthTime?: string;
  createdAt?: string;
}

export interface WechatAccountsResult {
  accounts: WechatAccount[];
  total: number;
}

export interface WechatPublishInput {
  wechatAppid: string;
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  author?: string;
  contentFormat?: WechatContentFormat;
  articleType?: WechatArticleType;
}

export interface WechatPublishResult {
  status: PublishStatus;
  message: string;
  publicationId?: string;
  materialId?: string;
  mediaId?: string;
}

type WechatOpenApiConfig = {
  apiKey: string;
  baseUrl: string;
};

type WechatErrorCode =
  | "API_KEY_MISSING"
  | "API_KEY_INVALID"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_TOKEN_EXPIRED"
  | "INVALID_PARAMETER"
  | "WECHAT_API_ERROR"
  | "INTERNAL_ERROR"
  | "WECHAT_OPENAPI_NOT_CONFIGURED"
  | "WECHAT_OPENAPI_BAD_RESPONSE"
  | "WECHAT_OPENAPI_REQUEST_FAILED"
  | "UNKNOWN";

export class WechatOpenApiError extends Error {
  code: WechatErrorCode;
  status: number;
  detail?: string;

  constructor(input: {
    code: WechatErrorCode;
    message: string;
    status?: number;
    detail?: string;
  }) {
    super(input.message);
    this.name = "WechatOpenApiError";
    this.code = input.code;
    this.status = input.status ?? 502;
    this.detail = input.detail;
  }
}

function getWechatOpenApiConfig(): WechatOpenApiConfig {
  const apiKey = process.env.WECHAT_OPENAPI_KEY?.trim();

  if (!apiKey) {
    throw new WechatOpenApiError({
      code: "WECHAT_OPENAPI_NOT_CONFIGURED",
      message: "WeChat publish service is not configured",
      status: 503,
      detail: "WECHAT_OPENAPI_KEY is missing"
    });
  }

  return {
    apiKey,
    baseUrl:
      process.env.WECHAT_OPENAPI_BASE_URL?.trim().replace(/\/+$/, "") ||
      DEFAULT_WECHAT_OPENAPI_BASE_URL
  };
}

function mapWechatErrorCode(value: unknown): WechatErrorCode {
  switch (value) {
    case "API_KEY_MISSING":
    case "API_KEY_INVALID":
    case "ACCOUNT_NOT_FOUND":
    case "ACCOUNT_TOKEN_EXPIRED":
    case "INVALID_PARAMETER":
    case "WECHAT_API_ERROR":
    case "INTERNAL_ERROR":
      return value;
    default:
      return "UNKNOWN";
  }
}

function mapStatusByCode(code: WechatErrorCode) {
  switch (code) {
    case "API_KEY_MISSING":
    case "WECHAT_OPENAPI_NOT_CONFIGURED":
      return 503;
    case "API_KEY_INVALID":
      return 401;
    case "ACCOUNT_NOT_FOUND":
      return 404;
    case "ACCOUNT_TOKEN_EXPIRED":
      return 401;
    case "INVALID_PARAMETER":
      return 400;
    case "WECHAT_API_ERROR":
      return 502;
    case "INTERNAL_ERROR":
      return 500;
    default:
      return 502;
  }
}

async function parseJsonSafely(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizePublishStatus(value: unknown): PublishStatus {
  if (value === "published") {
    return "published";
  }

  if (value === "publishing") {
    return "publishing";
  }

  if (value === "failed") {
    return "failed";
  }

  return "published";
}

function buildRequestInit(config: WechatOpenApiConfig, body?: object): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey
    },
    body: body ? JSON.stringify(body) : undefined
  };
}

function toWechatOpenApiError(input: {
  payload: Record<string, unknown> | null;
  status?: number;
  fallbackMessage: string;
}) {
  const payloadCode = mapWechatErrorCode(input.payload?.code);
  const code = payloadCode === "UNKNOWN" ? "WECHAT_OPENAPI_BAD_RESPONSE" : payloadCode;
  const message =
    (typeof input.payload?.error === "string" && input.payload.error) ||
    (typeof input.payload?.message === "string" && input.payload.message) ||
    input.fallbackMessage;

  return new WechatOpenApiError({
    code,
    message,
    status: input.status ?? mapStatusByCode(code),
    detail:
      input.payload && typeof input.payload === "object"
        ? JSON.stringify(input.payload)
        : undefined
  });
}

export async function listWechatAccounts(): Promise<WechatAccountsResult> {
  const config = getWechatOpenApiConfig();

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/wechat-accounts`,
      buildRequestInit(config)
    );
  } catch (error) {
    throw new WechatOpenApiError({
      code: "WECHAT_OPENAPI_REQUEST_FAILED",
      message: "Failed to fetch WeChat accounts",
      status: 502,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    throw toWechatOpenApiError({
      payload,
      status: response.status,
      fallbackMessage: "Failed to fetch WeChat accounts"
    });
  }

  if (!payload || payload.success !== true) {
    throw toWechatOpenApiError({
      payload,
      fallbackMessage: "Invalid WeChat account response"
    });
  }

  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const accounts = Array.isArray(data.accounts)
    ? (data.accounts as WechatAccount[])
    : [];
  const total =
    typeof data.total === "number" && Number.isFinite(data.total)
      ? data.total
      : accounts.length;

  return {
    accounts,
    total
  };
}

export async function publishWechatArticle(
  input: WechatPublishInput
): Promise<WechatPublishResult> {
  const config = getWechatOpenApiConfig();
  const payload: WechatPublishInput = {
    ...input,
    contentFormat: input.contentFormat ?? "markdown",
    articleType: input.articleType ?? "news"
  };

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/wechat-publish`,
      buildRequestInit(config, payload)
    );
  } catch (error) {
    throw new WechatOpenApiError({
      code: "WECHAT_OPENAPI_REQUEST_FAILED",
      message: "Failed to publish wechat content",
      status: 502,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    throw toWechatOpenApiError({
      payload: body,
      status: response.status,
      fallbackMessage: "Failed to publish wechat content"
    });
  }

  if (!body || body.success !== true) {
    throw toWechatOpenApiError({
      payload: body,
      fallbackMessage: "WeChat publish was rejected"
    });
  }

  const data = (body.data as Record<string, unknown> | undefined) ?? {};

  return {
    status: normalizePublishStatus(data.status),
    message:
      (typeof data.message === "string" && data.message) || "发布成功",
    publicationId:
      typeof data.publicationId === "string" ? data.publicationId : undefined,
    materialId: typeof data.materialId === "string" ? data.materialId : undefined,
    mediaId: typeof data.mediaId === "string" ? data.mediaId : undefined
  };
}
