const Collection = require("../util/Collection");
const util = require("util");

class BaseManager {
    constructor(client, iterable, holds, cacheLimitOptionKey = null) {
        if (!client) {
            throw new Error("BaseManager received an invalid client object.");
        }

        if (!client.options) {
            console.warn(
                `[BaseManager Warning] client.options is undefined...`,
            );
        }

        Object.defineProperty(this, "client", { value: client });
        Object.defineProperty(this, "holds", { value: holds });
        this.cache = new Collection();

        let limit = Infinity;
        if (
            cacheLimitOptionKey &&
            client.options &&
            typeof client.options[cacheLimitOptionKey] !== "undefined"
        ) {
            limit = client.options[cacheLimitOptionKey];
        } else if (client.options?.defaultCacheLimit) {
            limit = client.options.defaultCacheLimit;
        }
        this.cacheLimit =
            typeof limit === "number" && limit >= 0 ? limit : Infinity;

        if (iterable) {
            /* ... */
        }
    }

    resolve(idOrInstance) {
        if (idOrInstance instanceof this.holds) {
            return idOrInstance;
        }
        if (typeof idOrInstance === "string") {
            return this.cache.get(idOrInstance) || null;
        }
        return null;
    }

    resolveId(idOrInstance) {
        if (idOrInstance instanceof this.holds) {
            return idOrInstance.id;
        }
        if (typeof idOrInstance === "string") {
            return idOrInstance;
        }
        return null;
    }

    _add(data, cache = true, { id } = {}) {
        const existing = this.cache.get(id ?? data.id);
        if (existing && existing._patch && cache) {
            existing._patch(data);
            return existing;
        }

        const entry = this.holds ? new this.holds(this.client, data) : data;

        if (cache) {
            if (this.cacheLimit > 0 && this.cache.size >= this.cacheLimit) {
                this.cache.delete(this.cache.firstKey());
            }
            this.cache.set(id ?? entry.id, entry);
        }
        return entry;
    }

    _remove(id) {
        this.cache.delete(id);
    }
}

module.exports = BaseManager;
