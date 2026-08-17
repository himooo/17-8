export type DiscoveredModel = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  ownedBy?: string;
  supportsTextGeneration?: boolean;
};

type DiscoveryCandidate = {
  provider: string;
  key: string;
  baseUrl: string;
  modelsUrl?: string | null;
  apiKind: "provider" | "openai-compatible";
};

function cleanUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hash) throw new Error("رابط API أو النماذج غير صالح");
  return url.toString().replace(/\/$/, "");
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapModel(raw: any, provider: string): DiscoveredModel | null {
  const rawName = typeof raw?.id === "string"
    ? raw.id
    : typeof raw?.name === "string"
      ? raw.name
      : typeof raw?.model === "string"
        ? raw.model
        : typeof raw?.model_name === "string" ? raw.model_name : "";
  const id = rawName.replace(/^models\//, "").trim();
  if (!id || id.length > 200) return null;
  const supported: unknown[] = Array.isArray(raw?.supportedGenerationMethods)
    ? raw.supportedGenerationMethods
    : Array.isArray(raw?.supported_actions) ? raw.supported_actions : [];
  const supportsTextGeneration = supported.length === 0
    ? undefined
    : supported.includes("generateContent") || supported.includes("text-generation") || supported.includes("chat.completions");
  const displayName = typeof raw?.displayName === "string"
    ? raw.displayName
    : typeof raw?.display_name === "string" ? raw.display_name : id;
  const ownedBy = typeof raw?.owned_by === "string"
    ? raw.owned_by
    : typeof raw?.ownedBy === "string" ? raw.ownedBy : undefined;
  return {
    id,
    name: id,
    displayName,
    provider,
    inputTokenLimit: asNumber(raw?.inputTokenLimit ?? raw?.context_length),
    outputTokenLimit: asNumber(raw?.outputTokenLimit ?? raw?.max_output_tokens),
    ownedBy,
    supportsTextGeneration,
  };
}

export async function discoverModels(candidate: DiscoveryCandidate): Promise<DiscoveredModel[]> {
  const baseUrl = cleanUrl(candidate.baseUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (candidate.apiKind === "openai-compatible") headers.Authorization = `Bearer ${candidate.key}`;
  const models: DiscoveredModel[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const endpoint = candidate.modelsUrl ? cleanUrl(candidate.modelsUrl) : `${baseUrl}/models`;
    const url = new URL(endpoint);
    if (candidate.provider === "google" && candidate.apiKind === "provider") url.searchParams.set("key", candidate.key);
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);
    const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload?.error?.message === "string" ? payload.error.message.slice(0, 240) : `فشل جلب الموديلات HTTP ${response.status}`);
    const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : Array.isArray(payload) ? payload : [];
    rawList.forEach((item: any) => {
      const mapped = mapModel(item, candidate.provider);
      if (mapped && !models.some((model) => model.id === mapped.id)) models.push(mapped);
    });
    nextPageToken = typeof payload?.nextPageToken === "string" && payload.nextPageToken ? payload.nextPageToken : undefined;
    if (!nextPageToken || rawList.length === 0) break;
  }
  return models.slice(0, 2000);
}
