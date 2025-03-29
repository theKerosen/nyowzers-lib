const Base = require("./Base");

class Member extends Base {
    constructor(client, data, guild) {
        super(client);
        this.guild = guild;

        this.id = data.user?.id ?? data.id;

        if (data.user) {
            this.user = this.client.users._add(data.user);
        } else {
            this.user = this.client.users.cache.get(this.id);
        }

        this._patch(data);
    }

    _patch(data) {
        if ("nick" in data) this.nick = data.nick;
        if ("avatar" in data) this.guildAvatar = data.avatar;
        if ("roles" in data) this.roles = data.roles;
        if ("joined_at" in data)
            this.joinedTimestamp = Date.parse(data.joined_at);
        if ("premium_since" in data)
            this.premiumSinceTimestamp = data.premium_since
                ? Date.parse(data.premium_since)
                : null;
        if ("deaf" in data) this.deaf = data.deaf;
        if ("mute" in data) this.mute = data.mute;
        if ("pending" in data) this.pending = data.pending;

        if (!this.user && data.user) {
            this.user = this.client.users._add(data.user);
        }

        return this;
    }

    get joinedAt() {
        return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
    }

    get premiumSince() {
        return this.premiumSinceTimestamp
            ? new Date(this.premiumSinceTimestamp)
            : null;
    }

    get displayName() {
        return (
            this.nick ??
            this.user?.global_name ??
            this.user?.username ??
            "Unknown User"
        );
    }

    displayAvatarURL({ dynamic = true, size = 1024, format = "webp" } = {}) {
        if (this.guildAvatar) {
            let formatStr = format.toLowerCase();
            if (dynamic && this.guildAvatar.startsWith("a_")) {
                formatStr = "gif";
            }
            return `https://cdn.discordapp.com/guilds/${this.guild.id}/users/${this.id}/avatars/${this.guildAvatar}.${formatStr}?size=${size}`;
        }

        return this.user?.avatarURL({ dynamic, size, format }) ?? null;
    }

    toString() {
        return `<@!${this.id}>`;
    }
}

module.exports = Member;
