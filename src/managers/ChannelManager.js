const BaseManager = require("./BaseManager");
const Channel = require("../structures/Channel");
const Router = require("../rest/Router");

class ChannelManager extends BaseManager {
    constructor(client, iterable) {
        super(client, iterable, Channel, "channelCacheLimit");
    }

    _add(data, guild = null, { cache = true, id = null } = {}) {
        const existing = this.cache.get(id ?? data.id);

        if (existing && this.holds?.create && cache && !data.partial) {
            const guildRef =
                guild ||
                existing.guild ||
                this.client.guilds.cache.get(data.guild_id);
            return this.holds.create(this.client, data, guildRef);
        }

        if (this.holds?.create) {
            const guildRef =
                guild || this.client.guilds.cache.get(data.guild_id);
            const entry = this.holds.create(this.client, data, guildRef);
            if (cache) {
                if (this.cacheLimit > 0 && this.cache.size >= this.cacheLimit) {
                    this.cache.delete(this.cache.firstKey());
                }
                this.cache.set(entry.id, entry);
            }
            return entry;
        }

        return super._add(data, cache, { id });
    }

    async fetch(id, { force = false, cache = true } = {}) {
        if (!force) {
            const existing = this.cache.get(id);

            if (existing && !existing.partial) return existing;
        }

        try {
            const data = await this.client.rest.getChannel(id);

            return this._add(data, null, { cache });
        } catch (error) {
            if (error.status === 404) {
                this._remove(id);
                return null;
            }
            throw error;
        }
    }

    _remove(id) {
        const channel = this.cache.get(id);
        if (channel?.guild?.channels) {
            channel.guild.channels._remove(id);
        }
        super._remove(id);
    }
}

module.exports = ChannelManager;
