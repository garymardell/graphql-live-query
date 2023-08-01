/**
 * ResourceTracker is a ad hoc system for tracking events associated with a record.
 * In case the set of events change, the list can be updated by calling the `track`
 * method again with the previous and new event identifiers.
 * A set of all records that subscribe to a specific event can be retrieved with
 * the `getRecordsForIdentifiers` method.
 */
export declare class ResourceTracker<TRecord> {
    private _trackedResources;
    constructor();
    /**
     * Update the set of identifiers a resource is subscribed to.
     */
    track(record: TRecord, previousIdentifier: Set<string>, currentIdentifier: Set<string>): void;
    /**
     * Register a record and subscribe to the provided set of identifiers.
     *
     * @param record The record that should be tracked
     * @param identifiers The list of identifiers
     */
    register(record: TRecord, identifiers: Set<string>): void;
    /**
     * Release a record that subscribes to a specific set of identifiers.
     */
    release(record: TRecord, identifiers: Set<string>): void;
    /**
     * Get all records that subscribes to a specific set of identifiers
     */
    getRecordsForIdentifiers(identifiers: Array<string>): Set<TRecord>;
}
