import { useState, useCallback } from "react";
import { getSettings, setApiKey, setApiBaseUrl, updateSettings } from "@/services/settings";
import type { AppSettings } from "@/types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings);

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key);
    setSettings((prev) => ({ ...prev, apiKey: key }));
  }, []);

  const saveApiBaseUrl = useCallback((url: string) => {
    setApiBaseUrl(url);
    setSettings((prev) => ({ ...prev, apiBaseUrl: url }));
  }, []);

  const saveSettings = useCallback(
    (partial: Partial<Omit<AppSettings, "apiKey" | "apiBaseUrl">>) => {
      const updated = updateSettings(partial);
      setSettings(updated);
    },
    [],
  );

  return { settings, saveApiKey, saveApiBaseUrl, saveSettings };
}
