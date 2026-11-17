import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
    test: {
        env: loadEnv(mode, process.cwd(), ""),
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
}));