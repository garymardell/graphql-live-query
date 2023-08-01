import { DocumentNode, OperationDefinitionNode, TypeInfo } from "graphql";
import { Maybe } from "./Maybe.js";
/**
 * Returns an array that contains all the root query type field coordinates for a given graphql operation.
 */
export declare const extractLiveQueryRootFieldCoordinates: (params: {
    documentNode: DocumentNode;
    operationNode: OperationDefinitionNode;
    typeInfo: TypeInfo;
    variableValues?: Maybe<Record<string, unknown>>;
}) => Set<string>;
