import { GraphQLOutputType, GraphQLScalarType } from "graphql";
export declare const isNonNullIDScalarType: (type: GraphQLOutputType) => type is GraphQLScalarType<unknown, unknown>;
