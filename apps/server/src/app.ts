import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import type { RedisClientType } from "redis";
import type { Config } from "./config.js";
import { playerIdentity } from "./player/player.js";
import { roundsRouter } from "./rounds/routes.js";
import { createKeys } from "./rounds/keys.js";

const JSON_BODY_LIMIT = "256kb";

export interface AppDeps {
    config: Config;
    redis: RedisClientType;
    now?: () => Date;
}

export function createApp(deps: AppDeps) {
    const app = express();

    app.use(express.json({ limit: JSON_BODY_LIMIT }));
    app.use(cookieParser());

    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });

    app.use(
        "/rounds",
        playerIdentity({ secure: deps.config.cookieSecure }),
        roundsRouter({
            redis: deps.redis,
            keys: createKeys(deps.config.keyPrefix),
            dailySeedSecret: deps.config.dailySeedSecret,
            roundTtlSeconds: deps.config.roundTtlSeconds,
            now: deps.now ?? (() => new Date()),
        })
    );

    app.use((_req, res) => {
        res.status(404).json({ error: "not_found" });
    });

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        const status: number =
            typeof err?.status === "number" ? err.status : 500;

        if (status >= 500) {
            console.error(err);
            res.status(500).json({ error: "internal_error" });
            return;
        }

        res.status(status).json({ error: err.type ?? "bad_request" });
    };
    app.use(errorHandler);

    return app;
}