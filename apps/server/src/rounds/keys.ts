// Every key the app writes starts with a prefix, so Ghostwriter can share a
// Redis database with other apps (or with tests) without collisions.
export function createKeys(prefix: string) {
    return {
        round: (roundId: string) => `${prefix}round:${roundId}`,
        attempt: (date: string, playerId: string) =>
            `${prefix}daily:attempt:${date}:${playerId}`,
    };
}

export type Keys = ReturnType<typeof createKeys>;