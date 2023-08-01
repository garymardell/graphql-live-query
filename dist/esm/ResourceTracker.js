import { isNone } from "./Maybe.js";
/**
 * ResourceTracker is a ad hoc system for tracking events associated with a record.
 * In case the set of events change, the list can be updated by calling the `track`
 * method again with the previous and new event identifiers.
 * A set of all records that subscribe to a specific event can be retrieved with
 * the `getRecordsForIdentifiers` method.
 */
export class ResourceTracker {
    constructor() {
        this._trackedResources = new Map();
    }
    /**
     * Update the set of identifiers a resource is subscribed to.
     */
    track(record, 
    /* the previous identifiers that should get released */
    previousIdentifier, 
    /* the current identifiers that should be tracked */
    currentIdentifier) {
        for (const identifier of previousIdentifier) {
            if (currentIdentifier.has(identifier)) {
                continue;
            }
            let set = this._trackedResources.get(identifier);
            if (!set) {
                continue;
            }
            set.delete(record);
            if (set.size === 0) {
                this._trackedResources.delete(identifier);
            }
        }
        for (const identifier of currentIdentifier) {
            if (previousIdentifier.has(identifier)) {
                continue;
            }
            let set = this._trackedResources.get(identifier);
            if (isNone(set)) {
                set = new Set();
                this._trackedResources.set(identifier, set);
            }
            set.add(record);
        }
    }
    /**
     * Register a record and subscribe to the provided set of identifiers.
     *
     * @param record The record that should be tracked
     * @param identifiers The list of identifiers
     */
    register(record, identifiers) {
        this.track(record, new Set(), identifiers);
    }
    /**
     * Release a record that subscribes to a specific set of identifiers.
     */
    release(record, identifiers) {
        this.track(record, identifiers, new Set());
    }
    /**
     * Get all records that subscribes to a specific set of identifiers
     */
    getRecordsForIdentifiers(identifiers) {
        const records = new Set();
        for (const identifier of identifiers) {
            const recordSet = this._trackedResources.get(identifier);
            if (recordSet) {
                for (const record of recordSet) {
                    records.add(record);
                }
            }
        }
        return records;
    }
}
