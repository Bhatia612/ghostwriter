import express, { type ErrorRequestHandler } from "express";


const JSON_BODY_LIMIT = "256kb";

export function createApp() {
    const app = express();

    app.use(express.json({ limit: JSON_BODY_LIMIT }));

    app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
    });

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