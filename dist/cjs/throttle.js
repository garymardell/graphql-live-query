"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throttle = void 0;
/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 */
const throttle = (fn, wait) => {
    let timeout;
    let lastCalled = 0;
    let cancelled = false;
    const exec = (...args) => {
        if (!cancelled) {
            fn(...args);
            lastCalled = Date.now();
        }
    };
    const run = (...args) => {
        if (cancelled) {
            return;
        }
        const timeToNextTick = Math.max(0, wait - (Date.now() - lastCalled));
        if (!timeToNextTick) {
            // first execution, or wait === 0
            exec(...args);
        }
        else {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (Date.now() - lastCalled >= wait) {
                    exec(...args);
                }
            }, timeToNextTick);
        }
    };
    const cancel = () => {
        cancelled = true;
        clearTimeout(timeout);
    };
    return {
        run,
        cancel,
    };
};
exports.throttle = throttle;
