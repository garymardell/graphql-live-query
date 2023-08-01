import { isNonNullType, isScalarType, } from "graphql";
export const isNonNullIDScalarType = (type) => {
    if (isNonNullType(type)) {
        return isScalarType(type.ofType) && type.ofType.name === "GadgetID";
    }
    return false;
};
