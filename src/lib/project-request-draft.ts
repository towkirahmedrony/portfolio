import type { ProjectRequest, ProjectRequestValue } from "@/types/project-request";

export const PROJECT_REQUEST_DRAFT_KEY = "start-project-draft";
const DRAFT_VERSION = 1;
const MAX_DRAFT_BYTES = 180_000;

export type ProjectRequestDraft = {
  version: number;
  data: ProjectRequest;
  step: number;
  serviceId: string | null;
  savedAt: number;
};

function isProjectRequestValue(value: unknown): value is ProjectRequestValue {
  if (typeof value === "string") {
    return true;
  }

  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDraft(raw: string): ProjectRequestDraft | null {
  if (raw.length > MAX_DRAFT_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (record.version !== DRAFT_VERSION) {
      return null;
    }

    if (!record.data || typeof record.data !== "object" || Array.isArray(record.data)) {
      return null;
    }

    const data: ProjectRequest = {};
    for (const [key, value] of Object.entries(record.data as Record<string, unknown>)) {
      if (typeof key !== "string" || key.length === 0) {
        continue;
      }
      if (isProjectRequestValue(value)) {
        data[key] = value;
      }
    }

    const step = typeof record.step === "number" && Number.isInteger(record.step) ? record.step : 1;
    const serviceId =
      typeof record.serviceId === "string" && record.serviceId.length > 0
        ? record.serviceId
        : null;
    const savedAt =
      typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
        ? record.savedAt
        : Date.now();

    return {
      version: DRAFT_VERSION,
      data,
      step: Math.max(1, step),
      serviceId,
      savedAt,
    };
  } catch {
    return null;
  }
}

export function loadProjectRequestDraft(): ProjectRequestDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PROJECT_REQUEST_DRAFT_KEY);
    if (!raw) {
      return null;
    }
    return parseDraft(raw);
  } catch {
    return null;
  }
}

export function saveProjectRequestDraft(input: {
  data: ProjectRequest;
  step: number;
  serviceId: string | null;
}): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const draft: ProjectRequestDraft = {
    version: DRAFT_VERSION,
    data: input.data,
    step: Math.max(1, input.step),
    serviceId: input.serviceId,
    savedAt: Date.now(),
  };

  try {
    const serialized = JSON.stringify(draft);
    if (serialized.length > MAX_DRAFT_BYTES) {
      return false;
    }
    window.sessionStorage.setItem(PROJECT_REQUEST_DRAFT_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearProjectRequestDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(PROJECT_REQUEST_DRAFT_KEY);
  } catch {
    // Ignore storage access errors; the order has already been created.
  }
}

export function mergeProjectRequestDraft(
  base: ProjectRequest,
  draft: ProjectRequest,
): ProjectRequest {
  const next: ProjectRequest = { ...base };

  for (const [key, value] of Object.entries(draft)) {
    if (isProjectRequestValue(value)) {
      next[key] = value;
    }
  }

  return next;
}
