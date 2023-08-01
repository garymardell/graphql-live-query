import { GraphQLError, getOperationAST, defaultFieldResolver, TypeInfo, } from "graphql";
import { mapSchema, MapperKind, isAsyncIterable } from "@graphql-tools/utils";
import { Repeater } from "@repeaterjs/repeater";
import { getLiveDirectiveArgumentValues, getLiveDirectiveNode, } from "@n1ru4l/graphql-live-query";
import { extractLiveQueryRootFieldCoordinates } from "./extractLiveQueryRootFieldCoordinates.js";
import { isNonNullIDScalarType } from "./isNonNullIDScalarType.js";
import { runWith } from "./runWith.js";
import { isNone, isSome } from "./Maybe.js";
import { ResourceTracker } from "./ResourceTracker.js";
import { throttle } from "./throttle.js";
const originalContextSymbol = Symbol("originalContext");
const addResourceIdentifierCollectorToSchema = (schema, idFieldName) => mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typename) => {
        var _a;
        const newFieldConfig = { ...fieldConfig };
        let isIDField = fieldName === idFieldName && isNonNullIDScalarType(fieldConfig.type);
        let resolve = (_a = fieldConfig.resolve) !== null && _a !== void 0 ? _a : defaultFieldResolver;
        newFieldConfig.resolve = (src, args, context, info) => {
            var _a, _b;
            if (!context || originalContextSymbol in context === false) {
                return resolve(src, args, context, info);
            }
            const liveQueyContext = context;
            const result = resolve(src, args, liveQueyContext[originalContextSymbol], info);
            const fieldConfigExtensions = fieldConfig.extensions;
            if ((_a = fieldConfigExtensions === null || fieldConfigExtensions === void 0 ? void 0 : fieldConfigExtensions.liveQuery) === null || _a === void 0 ? void 0 : _a.collectResourceIdentifiers) {
                liveQueyContext.addResourceIdentifier(fieldConfigExtensions.liveQuery.collectResourceIdentifiers(src, args));
            }
            const fieldCoordinate = `${typename}.${fieldName}`;
            const indicesForCoordinate = (_b = liveQueyContext.indices) === null || _b === void 0 ? void 0 : _b.get(fieldCoordinate);
            if (indicesForCoordinate) {
                for (const index of indicesForCoordinate) {
                    let parts = [];
                    for (const part of index) {
                        if (Array.isArray(part)) {
                            if (args[part[0]] === part[1]) {
                                parts.push(`${part[0]}:"${args[part[0]]}"`);
                            }
                        }
                        else if (args[part] !== undefined) {
                            parts.push(`${part}:"${args[part]}"`);
                        }
                    }
                    if (parts.length) {
                        liveQueyContext.addResourceIdentifier(`${fieldCoordinate}(${parts.join(",")})`);
                    }
                }
            }
            if (isIDField) {
                runWith(result, (id) => liveQueyContext.collectResourceIdentifier({ typename, id }));
            }
            return result;
        };
        return newFieldConfig;
    },
});
export const defaultResourceIdentifierNormalizer = (params) => `${params.typename}:${params.id}`;
export class InMemoryLiveQueryStore {
    constructor(params) {
        var _a, _b;
        this._resourceTracker = new ResourceTracker();
        this._schemaCache = new WeakMap();
        this._buildResourceIdentifier = defaultResourceIdentifierNormalizer;
        this._includeIdentifierExtension = false;
        this._idFieldName = "id";
        this._indices = null;
        this.makeExecute = (execute) => (args) => {
            const { schema: inputSchema, document, rootValue, contextValue, variableValues, operationName, ...additionalArguments } = args;
            const operationNode = getOperationAST(document, operationName);
            const fallbackToDefaultExecute = () => execute({
                schema: inputSchema,
                document,
                rootValue,
                contextValue,
                variableValues,
                operationName,
                ...additionalArguments,
            });
            if (isNone(operationNode)) {
                return fallbackToDefaultExecute();
            }
            const liveDirectiveNode = getLiveDirectiveNode(operationNode);
            if (isNone(liveDirectiveNode)) {
                return fallbackToDefaultExecute();
            }
            let { isLive, throttleValue } = getLiveDirectiveArgumentValues(liveDirectiveNode, variableValues);
            if (isLive === false) {
                return fallbackToDefaultExecute();
            }
            if (isSome(this._validateThrottleValue)) {
                const maybeErrorOrNewThrottleValue = this._validateThrottleValue(throttleValue);
                if (typeof maybeErrorOrNewThrottleValue === "string") {
                    return {
                        errors: [
                            new GraphQLError(maybeErrorOrNewThrottleValue, [
                                liveDirectiveNode,
                            ]),
                        ],
                    };
                }
                else {
                    throttleValue = maybeErrorOrNewThrottleValue;
                }
            }
            const { schema, typeInfo } = this._getPatchedSchema(inputSchema);
            const rootFieldIdentifier = Array.from(extractLiveQueryRootFieldCoordinates({
                documentNode: document,
                operationNode,
                variableValues,
                typeInfo,
            }));
            const liveQueryStore = this;
            return new Repeater(async function liveQueryRepeater(push, onStop) {
                // utils for throttle
                let cancelThrottle;
                let run;
                let executionCounter = 0;
                let previousIdentifier = new Set(rootFieldIdentifier);
                function scheduleRun() {
                    run();
                }
                onStop.then(function dispose() {
                    cancelThrottle === null || cancelThrottle === void 0 ? void 0 : cancelThrottle();
                    liveQueryStore._resourceTracker.release(scheduleRun, previousIdentifier);
                });
                run = function run() {
                    executionCounter = executionCounter + 1;
                    const counter = executionCounter;
                    const newIdentifier = new Set(rootFieldIdentifier);
                    const collectResourceIdentifier = (parameter) => newIdentifier.add(liveQueryStore._buildResourceIdentifier(parameter));
                    const addResourceIdentifier = (values) => {
                        if (isNone(values)) {
                            return;
                        }
                        if (typeof values === "string") {
                            newIdentifier.add(values);
                            return;
                        }
                        for (const value of values) {
                            newIdentifier.add(value);
                        }
                    };
                    const context = {
                        [originalContextSymbol]: contextValue,
                        collectResourceIdentifier,
                        addResourceIdentifier,
                        indices: liveQueryStore._indices,
                    };
                    const result = execute({
                        schema,
                        document,
                        operationName,
                        rootValue,
                        contextValue: context,
                        variableValues,
                        ...additionalArguments,
                        // TODO: remove this type-cast once GraphQL.js 16-defer-stream with fixed return type got released
                    });
                    runWith(result, (result) => {
                        var _a;
                        if (isAsyncIterable(result)) {
                            (_a = result.return) === null || _a === void 0 ? void 0 : _a.call(result);
                            onStop(new Error(`"execute" returned a AsyncIterator instead of a MaybePromise<ExecutionResult>. The "NoLiveMixedWithDeferStreamRule" rule might have been skipped.`));
                            return;
                        }
                        if (counter === executionCounter) {
                            liveQueryStore._resourceTracker.track(scheduleRun, previousIdentifier, newIdentifier);
                            previousIdentifier = newIdentifier;
                            const liveResult = result;
                            liveResult.isLive = true;
                            if (liveQueryStore._includeIdentifierExtension === true) {
                                if (!liveResult.extensions) {
                                    liveResult.extensions = {};
                                }
                                liveResult.extensions.liveResourceIdentifier =
                                    Array.from(newIdentifier);
                            }
                            push(liveResult);
                        }
                    });
                };
                if (isSome(throttleValue)) {
                    const throttled = throttle(run, throttleValue);
                    run = throttled.run;
                    cancelThrottle = throttled.cancel;
                }
                liveQueryStore._resourceTracker.register(scheduleRun, previousIdentifier);
                run();
            });
        };
        if (params === null || params === void 0 ? void 0 : params.buildResourceIdentifier) {
            this._buildResourceIdentifier = params.buildResourceIdentifier;
        }
        if (params === null || params === void 0 ? void 0 : params.idFieldName) {
            this._idFieldName = params.idFieldName;
        }
        if (params === null || params === void 0 ? void 0 : params.validateThrottleValue) {
            this._validateThrottleValue = params.validateThrottleValue;
        }
        if (params === null || params === void 0 ? void 0 : params.indexBy) {
            this._indices = new Map();
            for (const { field, args } of params.indexBy) {
                let indices = this._indices.get(field);
                if (!indices) {
                    indices = [];
                    this._indices.set(field, indices);
                }
                indices.push(args);
            }
        }
        this._includeIdentifierExtension =
            (_a = params === null || params === void 0 ? void 0 : params.includeIdentifierExtension) !== null && _a !== void 0 ? _a : (typeof process === "undefined"
                ? false
                : ((_b = process === null || process === void 0 ? void 0 : process.env) === null || _b === void 0 ? void 0 : _b.NODE_ENV) === "development");
    }
    _getPatchedSchema(inputSchema) {
        let data = this._schemaCache.get(inputSchema);
        if (isNone(data)) {
            const schema = addResourceIdentifierCollectorToSchema(inputSchema, this._idFieldName);
            data = {
                schema,
                typeInfo: new TypeInfo(schema),
            };
            this._schemaCache.set(inputSchema, data);
        }
        return data;
    }
    /**
     * Invalidate queries (and schedule their re-execution) via a resource identifier.
     * @param identifiers A single or list of resource identifiers that should be invalidated.
     */
    async invalidate(identifiers) {
        if (typeof identifiers === "string") {
            identifiers = [identifiers];
        }
        const records = this._resourceTracker.getRecordsForIdentifiers(identifiers);
        for (const run of records) {
            run();
        }
    }
}
