import type { PublishStatus } from "@/lib/types";

const DEFAULT_XIAOHONGSHU_OPENAPI_BASE_URL = "https://note.limyai.com/api/openapi";

export interface XiaohongshuPublishInput {
  title?: string;
  content?: string;
  coverImage: string;
  images?: string[];
  tags?: string[];
  noteId?: string;
}

export interface XiaohongshuPublishResult {
  status: PublishStatus;
  message: string;
  publishUrl: string;
  qrImageUrl?: string;
  noteId?: string;
  publicationId?: string;
}

type XiaohongshuOpenApiConfig = {
  apiKey: string;
  baseUrl: string;
};

type XiaohongshuErrorCode =
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "DUPLICATE_NOTE_ID"
  | "SERVER_ERROR"
  | "XIAOHONGSHU_OPENAPI_NOT_CONFIGURED"
  | "XIAOHONGSHU_OPENAPI_BAD_RESPONSE"
  | "XIAOHONGSHU_OPENAPI_REQUEST_FAILED"
  | "UNKNOWN";

export class XiaohongshuOpenApiError extends Error {
  code: XiaohongshuErrorCode;
  status: number;
  detail?: string;

  constructor(input: {
    code: XiaohongshuErrorCode;
    message: string;
    status?: number;
    detail?: string;
  }) {
    super(input.message);
    this.name = "XiaohongshuOpenApiError";
    this.code = input.code;
    this.status = input.status ?? 502;
    this.detail = input.detail;
  }
}

function getXiaohongshuOpenApiConfig(): XiaohongshuOpenApiConfig {
  const apiKey =
    process.env.XIAOHONGSHU_OPENAPI_KEY?.trim() ||
    process.env.WECHAT_OPENAPI_KEY?.trim();

  if (!apiKey) {
    throw new XiaohongshuOpenApiError({
      code: "XIAOHONGSHU_OPENAPI_NOT_CONFIGURED",
      message: "Xiaohongshu publish service is not configured",
      status: 503,
      detail: "XIAOHONGSHU_OPENAPI_KEY is missing"
    });
  }

  return {
    apiKey,
    baseUrl:
      process.env.XIAOHONGSHU_OPENAPI_BASE_URL?.trim().replace(/\/+$/, "") ||
      DEFAULT_XIAOHONGSHU_OPENAPI_BASE_URL
  };
}

function mapXiaohongshuErrorCode(value: unknown): XiaohongshuErrorCode {
  switch (value) {
    case "AUTH_ERROR":
    case "VALIDATION_ERROR":
    case "DUPLICATE_NOTE_ID":
    case "SERVER_ERROR":
      return value;
    default:
      return "UNKNOWN";
  }
}

function mapStatusByCode(code: XiaohongshuErrorCode) {
  switch (code) {
    case "AUTH_ERROR":
      return 401;
    case "VALIDATION_ERROR":
      return 400;
    case "DUPLICATE_NOTE_ID":
      return 409;
    case "SERVER_ERROR":
      return 500;
    case "XIAOHONGSHU_OPENAPI_NOT_CONFIGURED":
      return 503;
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

function buildRequestInit(config: XiaohongshuOpenApiConfig, body: object): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey
    },
    body: JSON.stringify(body)
  };
}

function toXiaohongshuOpenApiError(input: {
  payload: Record<string, unknown> | null;
  status?: number;
  fallbackMessage: string;
}) {
  const payloadCode = mapXiaohongshuErrorCode(input.payload?.code);
  const code =
    payloadCode === "UNKNOWN" ? "XIAOHONGSHU_OPENAPI_BAD_RESPONSE" : payloadCode;
  const message =
    (typeof input.payload?.error === "string" && input.payload.error) ||
    (typeof input.payload?.message === "string" && input.payload.message) ||
    input.fallbackMessage;

  return new XiaohongshuOpenApiError({
    code,
    message,
    status: input.status ?? mapStatusByCode(code),
    detail:
      input.payload && typeof input.payload === "object"
        ? JSON.stringify(input.payload)
        : undefined
  });
}

function normalizePublishStatus(value: unknown): PublishStatus {
  if (value === "publishing") {
    return "publishing";
  }

  if (value === "failed") {
    return "failed";
  }

  return "published";
}

function sanitizeInput(input: XiaohongshuPublishInput): XiaohongshuPublishInput {
  const title = input.title?.trim();
  const content = input.content?.trim();
  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
  const images = input.images?.map((url) => url.trim()).filter(Boolean);

  return {
    title: title || undefined,
    content: content || undefined,
    coverImage: input.coverImage.trim(),
    images: images && images.length > 0 ? images : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    noteId: input.noteId?.trim() || undefined
  };
}

export async function publishXiaohongshuNote(
  input: XiaohongshuPublishInput
): Promise<XiaohongshuPublishResult> {
  const config = getXiaohongshuOpenApiConfig();
  const payload = sanitizeInput(input);

  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl}/publish_note`,
      buildRequestInit(config, payload)
    );
  } catch (error) {
    throw new XiaohongshuOpenApiError({
      code: "XIAOHONGSHU_OPENAPI_REQUEST_FAILED",
      message: "Failed to publish xiaohongshu note",
      status: 502,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    throw toXiaohongshuOpenApiError({
      payload: body,
      status: response.status,
      fallbackMessage: "Failed to publish xiaohongshu note"
    });
  }

  if (!body || body.success !== true) {
    throw toXiaohongshuOpenApiError({
      payload: body,
      fallbackMessage: "Xiaohongshu publish was rejected"
    });
  }

  const data = (body.data as Record<string, unknown> | undefined) ?? {};
  const publishUrl =
    typeof data.publish_url === "string" ? data.publish_url : undefined;

  if (!publishUrl) {
    throw new XiaohongshuOpenApiError({
      code: "XIAOHONGSHU_OPENAPI_BAD_RESPONSE",
      message: "Xiaohongshu publish response missing publish URL",
      status: 502,
      detail: JSON.stringify(data)
    });
  }

  return {
    status: normalizePublishStatus(data.status),
    message:
      (typeof data.message === "string" && data.message) ||
      "Published to Xiaohongshu successfully",
    publishUrl,
    qrImageUrl:
      typeof data.xiaohongshu_qr_image_url === "string"
        ? data.xiaohongshu_qr_image_url
        : undefined,
    noteId: typeof data.note_id === "string" ? data.note_id : undefined,
    publicationId: typeof data.id === "string" ? data.id : undefined
  };
}
