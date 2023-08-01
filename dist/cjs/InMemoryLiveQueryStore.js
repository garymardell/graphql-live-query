"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryLiveQueryStore = exports.defaultResourceIdentifierNormalizer = void 0;
const graphql_1 = require("graphql");
const utils_1 = require("@graphql-tools/utils");
const repeater_1 = require("@repeaterjs/repeater");
const graphql_live_query_1 = require("@n1ru4l/graphql-live-query");
const extractLiveQueryRootFieldCoordinates_js_1 = require("./extractLiveQueryRootFieldCoordinates.js");
const isNonNullIDScalarType_js_1 = require("./isNonNullIDScalarType.js");
const runWith_js_1 = require("./runWith.js");
const Maybe_js_1 = require("./Maybe.js");
const ResourceTracker_js_1 = require("./ResourceTracker.js");
const throttle_js_1 = require("./throttle.js");
const originalContextSymbol = Symbol("originalContext");
const addResourceIdentifierCollectorToSchema = (schema, idFieldName) => (0, utils_1.mapSchema)(schema, {
    [utils_1.MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typename) => {
        var _a;
        const newFieldConfig = { ...fieldConfig };
        let isIDField = fieldName === idFieldName && (0, isNonNullIDScalarType_js_1.isNonNullIDScalarType)(fieldConfig.type);
        let resolve = (_a = fieldConfig.resolve) !== null && _a !== void 0 ? _a : graphql_1.defaultFieldResolver;
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
                (0, runWith_js_1.runWith)(result, (id) => liveQueyContext.collectResourceIdentifier({ typename, id }));
            }
            return result;
        };
        return newFieldConfig;
    },
});
const defaultResourceIdentifierNormalizer = (params) => `${params.typename}:${params.id}`;
exports.defaultResourceIdentifierNormalizer = defaultResourceIdentifierNormalizer;
class InMemoryLiveQueryStore {
    constructor(params) {
        var _a, _b;
        this._resourceTracker = new ResourceTracker_js_1.ResourceTracker();
        this._schemaCache = new WeakMap();
        this._buildResourceIdentifier = exports.defaultResourceIdentifierNormalizer;
        this._includeIdentifierExtension = false;
        this._idFieldName = "id";
        this._indices = null;
        this.makeExecute = (execute) => (args) => {
            const { schema: inputSchema, document, rootValue, contextValue, variableValues, operationName, ...additionalArguments } = args;
            const operationNode = (0, graphql_1.getOperationAST)(document, operationName);
            const fallbackToDefaultExecute = () => execute({
                schema: inputSchema,
                document,
                rootValue,
                contextValue,
                variableValues,
                operationName,
                ...additionalArguments,
            });
            if ((0, Maybe_js_1.isNone)(operationNode)) {
                return fallbackToDefaultExecute();
            }
            const liveDirectiveNode = (0, graphql_live_query_1.getLiveDirectiveNode)(operationNode);
            if ((0, Maybe_js_1.isNone)(liveDirectiveNode)) {
                return fallbackToDefaultExecute();
            }
            let { isLive, throttleValue } = (0, graphql_live_query_1.getLiveDirectiveArgumentValues)(liveDirectiveNode, variableValues);
            if (isLive === false) {
                return fallbackToDefaultExecute();
            }
            if ((0, Maybe_js_1.isSome)(this._validateThrottleValue)) {
                const maybeErrorOrNewThrottleValue = this._validateThrottleValue(throttleValue);
                if (typeof maybeErrorOrNewThrottleValue === "string") {
                    return {
                        errors: [
                            new graphql_1.GraphQLError(maybeErrorOrNewThrottleValue, [
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
            const rootFieldIdentifier = Array.from((0, extractLiveQueryRootFieldCoordinates_js_1.extractLiveQueryRootFieldCoordinates)({
                documentNode: document,
                operationNode,
                variableValues,
                typeInfo,
            }));
            const liveQueryStore = this;
            return new repeater_1.Repeater(async function liveQueryRepeater(push, onStop) {
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
                        if ((0, Maybe_js_1.isNone)(values)) {
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
                    (0, runWith_js_1.runWith)(result, (result) => {
                        var _a;
                        if ((0, utils_1.isAsyncIterable)(result)) {
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
                if ((0, Maybe_js_1.isSome)(throttleValue)) {
                    const throttled = (0, throttle_js_1.throttle)(run, throttleValue);
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
        if ((0, Maybe_js_1.isNone)(data)) {
            const schema = addResourceIdentifierCollectorToSchema(inputSchema, this._idFieldName);
            data = {
                schema,
                typeInfo: new graphql_1.TypeInfo(schema),
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
exports.InMemoryLiveQueryStore = InMemoryLiveQueryStore;
