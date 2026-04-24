interface SiliconFlowConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface SiliconFlowImageConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CreateChatCompletionInput {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface CreateImageGenerationInput {
  prompt: string;
  image?: string;
  imageSize?: string;
}

const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_MODEL = "Pro/zai-org/GLM-4.7";
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_BUSY_RETRIES = 3;
const DEFAULT_IMAGE_FALLBACK_MODELS = ["Qwen/Qwen-Image", "Kwai-Kolors/Kolors"];

function isProviderBusy(status: number, bodyText: string) {
  return (
    status === 503 ||
    bodyText.includes('"code":50508') ||
    bodyText.includes("System is too busy now")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseImageFallbackModels() {
  const raw = process.env.SILICONFLOW_IMAGE_MODEL_FALLBACKS?.trim();

  if (!raw) {
    return DEFAULT_IMAGE_FALLBACK_MODELS;
  }

  return raw
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

export function getSiliconFlowConfig(): SiliconFlowConfig | null {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl:
      process.env.SILICONFLOW_BASE_URL?.trim().replace(/\/+$/, "") ||
      DEFAULT_BASE_URL,
    model: process.env.SILICONFLOW_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: Number(process.env.SILICONFLOW_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  };
}

export function getSiliconFlowImageConfig(): SiliconFlowImageConfig | null {
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  const model = process.env.SILICONFLOW_IMAGE_MODEL?.trim();

  if (!apiKey || !model) {
    return null;
  }

  return {
    apiKey,
    baseUrl:
      process.env.SILICONFLOW_BASE_URL?.trim().replace(/\/+$/, "") ||
      DEFAULT_BASE_URL,
    model,
    timeoutMs:
      Number(process.env.SILICONFLOW_IMAGE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  };
}

function supportsImageSize(model: string) {
  return model !== "Qwen/Qwen-Image-Edit-2509";
}

function supportsBatchSize(model: string) {
  return !model.includes("Qwen/Qwen-Image");
}

function isModelUnavailable(status: number, bodyText: string) {
  if (status !== 400) {
    return false;
  }

  return (
    bodyText.includes('"code":20012') ||
    bodyText.toLowerCase().includes("model does not exist")
  );
}

function resolveImageModelCandidates(input: {
  configuredModel: string;
  hasInputImage: boolean;
}) {
  const deduped = new Set<string>();
  deduped.add(input.configuredModel);

  for (const fallbackModel of parseImageFallbackModels()) {
    deduped.add(fallbackModel);
  }
  return [...deduped];
}

function readImageUrl(payload: {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  images?: Array<{
    url?: string;
    b64_json?: string;
  }>;
}) {
  const candidates = [...(payload.data ?? []), ...(payload.images ?? [])];
  const url = candidates.find((item) => item.url)?.url;

  if (url) {
    return url;
  }

  const b64Json = candidates.find((item) => item.b64_json)?.b64_json;

  return b64Json ? `data:image/png;base64,${b64Json}` : null;
}

export async function createSiliconFlowChatCompletion(
  input: CreateChatCompletionInput
) {
  const config = getSiliconFlowConfig();

  if (!config) {
    throw new Error("SiliconFlow is not configured");
  }

  for (let attempt = 1; attempt <= MAX_BUSY_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 4000
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const bodyText = await response.text();

        if (isProviderBusy(response.status, bodyText) && attempt < MAX_BUSY_RETRIES) {
          await wait(attempt * 1_500);
          continue;
        }

        throw new Error(
          `SiliconFlow request failed with ${response.status}: ${bodyText || "empty response"}`
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("SiliconFlow returned an empty completion");
      }

      return content;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new Error(
          `SiliconFlow request timed out after ${config.timeoutMs}ms`
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("SiliconFlow request failed after retries");
}

export async function createSiliconFlowImageGeneration(
  input: CreateImageGenerationInput
) {
  const config = getSiliconFlowImageConfig();

  if (!config) {
    throw new Error("SiliconFlow image generation is not configured");
  }

  const modelCandidates = resolveImageModelCandidates({
    configuredModel: config.model,
    hasInputImage: Boolean(input.image)
  });
  let lastModelUnavailableError: Error | null = null;

  modelLoop: for (const model of modelCandidates) {
    for (let attempt = 1; attempt <= MAX_BUSY_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const requestBody: Record<string, unknown> = {
          model,
          prompt: input.prompt
        };

        if (supportsBatchSize(model)) {
          requestBody.batch_size = 1;
        }

        if (input.image) {
          requestBody.image = input.image;
        }

        if (input.imageSize && supportsImageSize(model)) {
          requestBody.image_size = input.imageSize;
        }

        const response = await fetch(`${config.baseUrl}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        if (!response.ok) {
          const bodyText = await response.text();

          if (
            isProviderBusy(response.status, bodyText) &&
            attempt < MAX_BUSY_RETRIES
          ) {
            await wait(attempt * 1_500);
            continue;
          }

          if (
            isModelUnavailable(response.status, bodyText) &&
            model !== modelCandidates[modelCandidates.length - 1]
          ) {
            lastModelUnavailableError = new Error(
              `SiliconFlow model unavailable: ${model}`
            );
            continue modelLoop;
          }

          throw new Error(
            `SiliconFlow image request failed with ${response.status}: ${bodyText || "empty response"}`
          );
        }

        const payload = (await response.json()) as {
          data?: Array<{
            url?: string;
            b64_json?: string;
          }>;
          images?: Array<{
            url?: string;
            b64_json?: string;
          }>;
        };
        const imageUrl = readImageUrl(payload);

        if (!imageUrl) {
          throw new Error("SiliconFlow returned an empty image response");
        }

        return imageUrl;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `SiliconFlow image request timed out after ${config.timeoutMs}ms`
          );
        }

        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  if (lastModelUnavailableError) {
    throw lastModelUnavailableError;
  }

  throw new Error("SiliconFlow image request failed after retries");
}
