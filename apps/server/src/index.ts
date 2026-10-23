import { createClient, type RedisClientType } from "redis";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const redis: RedisClientType = createClient({ url: config.redisUrl });
redis.on("error", (err) => console.error("redis error", err));
await redis.connect();

createApp({ config, redis }).listen(config.port, () => {
    console.log(`ghostwriter server listening on port ${config.port}`);
});