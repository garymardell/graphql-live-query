import { visitWithTypeInfo, visit, } from "graphql";
import { getArgumentValues } from "graphql/execution/values.js";
import { isNone, isSome } from "./Maybe.js";
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
                if (isNone(fragment)) {
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
export const extractLiveQueryRootFieldCoordinates = (params) => {
    const identifier = new Set();
    visit(params.documentNode, visitWithTypeInfo(params.typeInfo, {
        Field(fieldNode) {
            var _a;
            const parentType = params.typeInfo.getParentType();
            if (isSome(parentType) &&
                parentType.name === "Query" &&
                isSome((_a = fieldNode.arguments) === null || _a === void 0 ? void 0 : _a.length)) {
                const fieldDef = params.typeInfo.getFieldDef();
                identifier.add(`Query.${fieldNode.name.value}`);
                if (isSome(fieldDef)) {
                    for (const arg of fieldDef.args) {
                        if (arg.name === "id") {
                            const fieldSDLType = arg.type.toString();
                            if (fieldSDLType === "GadgetID!" || fieldSDLType === "GadgetID") {
                                const values = getArgumentValues(fieldDef, fieldNode, params.variableValues);
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
