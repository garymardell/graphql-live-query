// invokes the callback with the resolved or sync input. Handy when you don't know whether the input is a Promise or the actual value you want.
export const runWith = (input, callback) => {
    if (input instanceof Promise) {
        input.then(callback, () => undefined);
    }
    else {
        callback(input);
    }
};
