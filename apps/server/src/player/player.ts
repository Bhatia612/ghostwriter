import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { isUuid } from "../lib/uuid.js";

export const PLAYER_COOKIE = "gw_player";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

declare module "express-serve-static-core" {
    interface Request {
        playerId: string;
    }
}

export function playerIdentity(opts: { secure: boolean }): RequestHandler {
    return (req, res, next) => {
        const existing: unknown = req.cookies?.[PLAYER_COOKIE];

        if (isUuid(existing)) {
            req.playerId = existing;
            return next();
        }

        req.playerId = randomUUID();
        res.cookie(PLAYER_COOKIE, req.playerId, {
            httpOnly: true,
            sameSite: "lax",
            secure: opts.secure,
            maxAge: ONE_YEAR_MS,
        });
        next();
    };
}