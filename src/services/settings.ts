import { DEFAULT_SETTINGS, type AppSettings } from "@/types";
import { STORAGE_KEYS } from "@/lib/constants";

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEYS.apiKey) ?? "";
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
}

export function getApiBaseUrl(): string {
  return localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || "https://api.deepseek.com";
}

export function setApiBaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEYS.apiBaseUrl, url);
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKey: getApiKey(),
      apiBaseUrl: getApiBaseUrl(),
    };
  } catch {
    return { ...DEFAULT_SETTINGS, apiKey: getApiKey(), apiBaseUrl: getApiBaseUrl() };
  }
}

export function updateSettings(
  partial: Partial<Omit<AppSettings, "apiKey" | "apiBaseUrl">>,
): AppSettings {
  const current = getSettings();
  const updated: AppSettings = { ...current, ...partial };
  const { apiKey, apiBaseUrl, ...toStore } = updated;
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(toStore));
  return updated;
}
