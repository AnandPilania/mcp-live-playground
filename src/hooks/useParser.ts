import { useState, useEffect, useMemo } from "react";
import { parseServer, detectLanguage } from "@/lib/parser";
import type { ParsedServer } from "@/types";

export { detectLanguage };

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export function useParser(code: string) {
    const debouncedCode = useDebounce(code, 350);
    const [parseMs, setParseMs] = useState<number | null>(null);

    const parsed = useMemo((): ParsedServer => {
        const t0 = performance.now();
        const result = parseServer(debouncedCode);
        setParseMs(Math.round((performance.now() - t0) * 10) / 10);
        return result;
    }, [debouncedCode]);

    return { parsed, parseMs, debouncedCode };
}
