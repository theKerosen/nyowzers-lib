const BaseManager = require("./BaseManager");
const User = require("../structures/User");
const Router = require("../rest/Router");

class UserManager extends BaseManager {
    constructor(client, iterable) {
        super(client, iterable, User, "userCacheLimit");
    }

    async fetch(id, { force = false } = {}) {
        if (!force) {
            const existing = this.cache.get(id);
            if (existing) return existing;
        }

        const data = await this.client.rest.getUser(id);
        return this._add(data, true);
    }
}

module.exports = UserManager;
