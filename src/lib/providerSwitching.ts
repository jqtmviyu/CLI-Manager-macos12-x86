import type { Project } from "./types";

export type ProviderSwitchAppType = "claude" | "codex";

export interface CodexProviderOverride {
  providerId: string;
  providerName: string | null;
  profileName: string;
  vendorHint?: string | null;
}

export interface ProjectProviderOverrides {
  codex?: CodexProviderOverride;
}

export function getProviderSwitchAppType(project: Pick<Project, "cli_tool">): ProviderSwitchAppType | null {
  const cliTool = project.cli_tool.trim().toLowerCase();
  if (cliTool === "codex") return "codex";
  if (cliTool.includes("claude")) return "claude";
  return null;
}

export function isExactCodexProject(project: Pick<Project, "cli_tool">): boolean {
  return project.cli_tool.trim().toLowerCase() === "codex";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCodexOverride(value: unknown): CodexProviderOverride | undefined {
  if (!isRecord(value)) return undefined;
  const providerId = typeof value.providerId === "string" ? value.providerId.trim() : "";
  const profileName = typeof value.profileName === "string" ? value.profileName.trim() : "";
  if (!providerId || !profileName) return undefined;
  return {
    providerId,
    profileName,
    providerName: typeof value.providerName === "string" && value.providerName.trim() ? value.providerName : null,
    vendorHint: typeof value.vendorHint === "string" && value.vendorHint.trim() ? value.vendorHint.trim() : null,
  };
}

export function parseProjectProviderOverrides(raw: string | null | undefined): ProjectProviderOverrides {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const codex = normalizeCodexOverride(parsed.codex);
    return codex ? { codex } : {};
  } catch {
    return {};
  }
}

export function stringifyProjectProviderOverrides(overrides: ProjectProviderOverrides): string {
  const next: Record<string, unknown> = {};
  if (overrides.codex) {
    next.codex = {
      providerId: overrides.codex.providerId,
      providerName: overrides.codex.providerName,
      profileName: overrides.codex.profileName,
    };
    if (overrides.codex.vendorHint) {
      (next.codex as Record<string, unknown>).vendorHint = overrides.codex.vendorHint;
    }
  }
  return JSON.stringify(next);
}

export function getCodexProviderOverride(project: Pick<Project, "provider_overrides">): CodexProviderOverride | undefined {
  return parseProjectProviderOverrides(project.provider_overrides).codex;
}

export function withCodexProviderOverride(
  raw: string | null | undefined,
  override: CodexProviderOverride | null
): string {
  const overrides = parseProjectProviderOverrides(raw);
  if (override) {
    overrides.codex = override;
  } else {
    delete overrides.codex;
  }
  return stringifyProjectProviderOverrides(overrides);
}

export function parseProjectEnvVars(project: Pick<Project, "env_vars">): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(project.env_vars || "{}");
    if (!isRecord(parsed)) return undefined;
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string");
    if (entries.length > 0) return Object.fromEntries(entries);
  } catch {
    // Ignore invalid env JSON and let terminal start without project env overrides.
  }
  return undefined;
}
