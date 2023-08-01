"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNonNullIDScalarType = void 0;
const graphql_1 = require("graphql");
const isNonNullIDScalarType = (type) => {
    if ((0, graphql_1.isNonNullType)(type)) {
        return (0, graphql_1.isScalarType)(type.ofType) && type.ofType.name === "GadgetID";
    }
    return false;
};
exports.isNonNullIDScalarType = isNonNullIDScalarType;
