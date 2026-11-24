import type { KeystrokeLog, ScoreResult } from "@ghostwriter/scoring";

export type Mode = "ranked" | "practice";

export interface Round {
    roundId: string;
    mode: Mode;
    date: string;
    passage: string;
    expiresAt: string;
}


export class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string) {
        super(`${status} ${code}`);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        credentials: "include",
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        let code = "unknown_error";
        try {
            const data: unknown = await res.json();
            if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
                code = data.error;
            }
        } catch {
        }
        throw new ApiError(res.status, code);
    }

    return (await res.json()) as T;
}

export function startRound(mode: Mode): Promise<Round> {
    return postJson<Round>("/rounds", { mode });
}

export interface SubmitResponse {
    roundId: string;
    mode: Mode;
    date: string;
    result: ScoreResult;
    replayed: boolean;
}

export interface SubmitOptions {
    attempts?: number;
    wait?: (ms: number) => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));


export async function submitRound(
    roundId: string,
    log: KeystrokeLog,
    { attempts = 3, wait = sleep }: SubmitOptions = {}
): Promise<SubmitResponse> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await postJson<SubmitResponse>(`/rounds/${encodeURIComponent(roundId)}/submit`, { log });
        } catch (err) {
            const retryable = !(err instanceof ApiError) || err.status >= 500;
            if (!retryable || attempt >= attempts) throw err;
            await wait(250 * 2 ** (attempt - 1));
        }
    }
}