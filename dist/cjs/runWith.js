"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWith = void 0;
// invokes the callback with the resolved or sync input. Handy when you don't know whether the input is a Promise or the actual value you want.
const runWith = (input, callback) => {
    if (input instanceof Promise) {
        input.then(callback, () => undefined);
    }
    else {
        callback(input);
    }
};
exports.runWith = runWith;
