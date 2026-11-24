// 1284.4 -> "1,284"
export function formatScore(score: number): string {
    return Math.round(score).toLocaleString("en-US");
}

// 27830 -> "0:27.8"
export function formatDuration(ms: number): string {
    const tenths = Math.round(ms / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = (tenths % 600) / 10;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

// 0.974 -> "97%"
export function formatAccuracy(accuracy: number): string {
    return `${Math.round(accuracy * 100)}%`;
}

// How many whole words of the passage were typed correctly.
export function wordsCompleted(passage: string, correctChars: number): number {
    const words = passage.split(" ");
    let end = 0;
    let done = 0;
    for (const word of words) {
        end += word.length;
        if (end > correctChars) break;
        done++;
        end += 1;
    }
    return done;
}