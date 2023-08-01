export interface ThrottledFunction {
    run: (...args: unknown[]) => void;
    cancel: () => void;
}
/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 */
export declare const throttle: <T>(fn: (...args: unknown[]) => T | Promise<T>, wait: number) => ThrottledFunction;
