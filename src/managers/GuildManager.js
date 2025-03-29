const BaseManager = require("./BaseManager");
const Guild = require("../structures/Guild");
const MemberManager = require("./MemberManager");

class GuildManager extends BaseManager {
    constructor(client, iterable) {
        super(client, iterable, Guild, "guildCacheLimit");
    }

    _add(data, cache = true) {
        const existing = this.cache.get(data.id);

        if (existing) {
            if (data.hasOwnProperty("unavailable")) {
                existing.unavailable = data.unavailable;
            }

            if (!existing.unavailable && !existing._memberManagerInstance) {
                existing._memberManagerInstance = new MemberManager(
                    existing,
                    null,
                    this.client,
                );
            }

            if (!existing.unavailable) {
                existing._patch(data);
            }
            return existing;
        } else {
            const guild = new Guild(this.client, data);

            guild._memberManagerInstance = new MemberManager(
                guild,
                null,
                this.client,
            );

            if (!guild.unavailable) {
                if (Array.isArray(data.members) && guild.members) {
                    guild.members.cache.clear();
                    for (const memData of data.members) {
                        guild.members._add(memData);
                    }
                }
            }

            if (cache) {
                if (this.cacheLimit > 0 && this.cache.size >= this.cacheLimit) {
                    this.cache.delete(this.cache.firstKey());
                }
                this.cache.set(guild.id, guild);
            }
            return guild;
        }
    }

    async fetch(id, { force = false } = {}) {
        if (!force) {
            const existing = this.cache.get(id);

            if (existing && !existing.partial && !existing.unavailable)
                return existing;
        }

        try {
            const data = await this.client.rest.getGuild(id);
            return this._add(data, true);
        } catch (error) {
            if (error.status === 404) {
                this._remove(id);
                return null;
            }
            throw error;
        }
    }

    _remove(id) {
        const guild = this.cache.get(id);
        if (guild) {
            this.client.channels.cache.sweep((c) => c.guildId === id);
            guild._memberManagerInstance?.cache.clear();
        }
        super._remove(id);
    }
}

module.exports = GuildManager;
