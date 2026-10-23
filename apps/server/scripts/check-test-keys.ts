import { createClient } from "redis";

const url = process.env.REDIS_URL;
if (!url) {
    console.error("REDIS_URL is not set. Run this with --env-file=.env");
    process.exit(1);
}

const redis = createClient({ url });
await redis.connect();

const leftover: string[] = [];
for await (const batch of redis.scanIterator({ MATCH: "gwtest:*", COUNT: 100 })) {
    leftover.push(...batch);
}
await redis.quit();

if (leftover.length === 0) {
    console.log("OK: no leftover test keys.");
} else {
    console.log(`Found ${leftover.length} leftover test key(s):`);
    for (const key of leftover) console.log(`  ${key}`);
    process.exitCode = 1;
}