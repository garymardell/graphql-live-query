"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLiveQueryRootFieldCoordinates = void 0;
const graphql_1 = require("graphql");
const values_js_1 = require("graphql/execution/values.js");
const Maybe_js_1 = require("./Maybe.js");
const gatherFields = (selectionSet, documentNode) => {
    var _a, _b;
    const fields = [];
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case "Field": {
                (_a = selection.arguments) === null || _a === void 0 ? void 0 : _a.filter((arg) => arg.value.kind === "Variable");
                fields.push(selection);
                continue;
            }
            case "InlineFragment": {
                fields.push(...gatherFields(selection.selectionSet, documentNode));
                continue;
            }
            case "FragmentSpread": {
                const fragment = ((_b = documentNode.definitions.find((definition) => definition.kind === "FragmentDefinition" &&
                    definition.name.value === selection.name.value)) !== null && _b !== void 0 ? _b : null);
                if ((0, Maybe_js_1.isNone)(fragment)) {
                    // We can abort collecting the identifiers as GraphQL execution will complain.
                    break;
                }
                fields.push(...gatherFields(fragment.selectionSet, documentNode));
                continue;
            }
        }
    }
    return fields;
};
/**
 * Returns an array that contains all the root query type field coordinates for a given graphql operation.
 */
const extractLiveQueryRootFieldCoordinates = (params) => {
    const identifier = new Set();
    (0, graphql_1.visit)(params.documentNode, (0, graphql_1.visitWithTypeInfo)(params.typeInfo, {
        Field(fieldNode) {
            var _a;
            const parentType = params.typeInfo.getParentType();
            if ((0, Maybe_js_1.isSome)(parentType) &&
                parentType.name === "Query" &&
                (0, Maybe_js_1.isSome)((_a = fieldNode.arguments) === null || _a === void 0 ? void 0 : _a.length)) {
                const fieldDef = params.typeInfo.getFieldDef();
                identifier.add(`Query.${fieldNode.name.value}`);
                if ((0, Maybe_js_1.isSome)(fieldDef)) {
                    for (const arg of fieldDef.args) {
                        if (arg.name === "id") {
                            const fieldSDLType = arg.type.toString();
                            if (fieldSDLType === "GadgetID!" || fieldSDLType === "GadgetID") {
                                const values = (0, values_js_1.getArgumentValues)(fieldDef, fieldNode, params.variableValues);
                                identifier.add(`Query.${fieldNode.name.value}(${arg.name}:"${values["id"]}")`);
                            }
                            break;
                        }
                    }
                }
            }
        },
    }));
    return identifier;
};
exports.extractLiveQueryRootFieldCoordinates = extractLiveQueryRootFieldCoordinates;
