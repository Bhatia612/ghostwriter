export interface Config {
    port: number;
    redisUrl: string;
    keyPrefix: string;
    dailySeedSecret: string;
    roundTtlSeconds: number;
    cookieSecure: boolean;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    return {
        port: Number(env.PORT ?? 3000),
        redisUrl: required(env, "REDIS_URL"),
        keyPrefix: env.KEY_PREFIX ?? "gw:",
        dailySeedSecret: required(env, "DAILY_SEED_SECRET"),
        roundTtlSeconds: Number(env.ROUND_TTL_SECONDS ?? 600),
        cookieSecure: env.NODE_ENV === "production",
    };
}