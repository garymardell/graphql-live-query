import { ExecutionResult, execute as defaultExecute, ExecutionArgs } from "graphql";
import { LiveExecutionResult } from "@n1ru4l/graphql-live-query";
import { Maybe } from "./Maybe.js";
declare type PromiseOrValue<T> = T | Promise<T>;
declare type ArgumentName = string;
declare type ArgumentValue = string;
declare type IndexConfiguration = Array<ArgumentName | [arg: ArgumentName, value: ArgumentValue]>;
export declare type BuildResourceIdentifierFunction = (parameter: Readonly<{
    typename: string;
    id: string;
}>) => string;
export declare const defaultResourceIdentifierNormalizer: BuildResourceIdentifierFunction;
export declare type ValidateThrottleValueFunction = (throttleValue: Maybe<number>) => Maybe<string | number>;
export declare type InMemoryLiveQueryStoreParameter = {
    /**
     * Custom function for building resource identifiers.
     * By default resource identifiers are built by concatenating the Typename with the id separated by a color (`User:1`).
     * See `defaultResourceIdentifierNormalizer`
     *
     * This may be useful if you are using a relay compliant schema and the Typename information is not required for building a unique topic.
     * */
    buildResourceIdentifier?: BuildResourceIdentifierFunction;
    /**
     * Whether the extensions should include a list of all resource identifiers for the latest operation result.
     * Any of those can be used for invalidating and re-scheduling the operation execution.
     *
     * This is mainly useful for discovering and learning what kind of topics a given query will subscribe to.
     * The default value is `true` if `process.env.NODE_ENV` is equal to `"development"` and `false` otherwise.
     * */
    includeIdentifierExtension?: boolean;
    idFieldName?: string;
    /**
     * Validate the provided throttle value.
     *
     * Return a string for triggering an error and stopping the execution.
     * Return a number for overriding the provided value.
     * Return null or undefined for disabling throttle completely.
     */
    validateThrottleValue?: ValidateThrottleValueFunction;
    /**
     * Specify which fields should be indexed for specific invalidations.
     */
    indexBy?: Array<{
        field: string;
        args: IndexConfiguration;
    }>;
};
declare type LiveExecuteReturnType = PromiseOrValue<AsyncIterableIterator<ExecutionResult | LiveExecutionResult> | ExecutionResult>;
export declare class InMemoryLiveQueryStore {
    private _resourceTracker;
    private _schemaCache;
    private _buildResourceIdentifier;
    private _includeIdentifierExtension;
    private _idFieldName;
    private _validateThrottleValue;
    private _indices;
    constructor(params?: InMemoryLiveQueryStoreParameter);
    private _getPatchedSchema;
    makeExecute: (execute: typeof defaultExecute) => (args: ExecutionArgs) => LiveExecuteReturnType;
    /**
     * Invalidate queries (and schedule their re-execution) via a resource identifier.
     * @param identifiers A single or list of resource identifiers that should be invalidated.
     */
    invalidate(identifiers: Array<string> | string): Promise<void>;
}
export {};
