const BaseManager = require("./BaseManager");
const Member = require("../structures/Member");
const Collection = require("../util/Collection");

class MemberManager extends BaseManager {
    constructor(guild, iterable, client) {
        if (!client) {
            throw new Error(
                "MemberManager constructor requires a valid client argument.",
            );
        }

        super(client, iterable, Member, "memberCacheLimit");
        this.guild = guild;
    }

    _add(data, cache = true) {
        const existing = this.cache.get(data.user?.id ?? data.id);
        if (existing && cache) {
            return existing._patch(data);
        }
        if (data.user) {
            this.client.users._add(data.user);
        }

        const member = new Member(this.client, data, this.guild);
        if (cache) {
            this.cache.set(member.id, member);
        }
        return member;
    }

    async fetch(idOrOptions, { force = false, cache = true } = {}) {
        let id;
        if (typeof idOrOptions === "string") {
            id = idOrOptions;
        } else if (typeof idOrOptions === "object" && idOrOptions !== null) {
            if (idOrOptions.user)
                id = this.client.users.resolveId(idOrOptions.user);
            else if (idOrOptions.query) {
                return this.search(idOrOptions.query, idOrOptions.limit);
            } else {
                return this.list(idOrOptions.limit, idOrOptions.after);
            }
        }

        if (!id)
            throw new Error(
                "Invalid user resolvable provided to fetch member.",
            );

        if (!force) {
            const existing = this.cache.get(id);
            if (existing) return existing;
        }

        try {
            const data = await this.client.rest.getGuildMember(
                this.guild.id,
                id,
            );
            return this._add(data, cache);
        } catch (error) {
            if (error.status === 404) {
                this._remove(id);
                return null;
            }
            throw error;
        }
    }

    async list(limit = 1000, after = undefined) {
        const query = new URLSearchParams();
        if (limit) query.set("limit", limit);
        if (after) query.set("after", after);

        const data = await this.client.rest.getGuildMembers(
            this.guild.id,
            query,
        );
        const results = new Collection();
        for (const memberData of data) {
            const member = this._add(memberData);
            results.set(member.id, member);
        }
        return results;
    }

    async search(query, limit = 1) {
        const params = new URLSearchParams({ query, limit });
        const data = await this.client.rest.searchGuildMembers(
            this.guild.id,
            params,
        );
        const results = new Collection();
        for (const memberData of data) {
            const member = this._add(memberData);
            results.set(member.id, member);
        }
        return results;
    }
}

module.exports = MemberManager;
