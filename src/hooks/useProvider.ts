import { useState, useCallback } from "react";
import {
    loadProvider,
    saveProvider,
    getDefaultProvider,
    DEFAULT_PROVIDERS,
} from "@/providers";
import type { LLMProvider, LLMProviderType } from "@/types";

export function useProvider() {
    const [provider, setProvider] = useState<LLMProvider>(
        () => loadProvider() || getDefaultProvider("anthropic")
    );

    const updateProvider = useCallback((updates: Partial<LLMProvider>) => {
        setProvider((prev) => {
            const next = { ...prev, ...updates };
            saveProvider(next);
            return next;
        });
    }, []);

    const switchProviderType = useCallback(
        (type: LLMProviderType) => {
            const next: LLMProvider = {
                ...DEFAULT_PROVIDERS[type],
                apiKey: provider.apiKey,
            };
            saveProvider(next);
            setProvider(next);
        },
        [provider.apiKey]
    );

    return { provider, updateProvider, switchProviderType };
}
