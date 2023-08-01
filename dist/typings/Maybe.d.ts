export declare type None = null | undefined;
export declare const isSome: <T>(input: T) => input is Exclude<T, None>;
export declare const isNone: <T>(input: None | T) => input is None;
export declare type Maybe<T> = T | None;
