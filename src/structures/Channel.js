const Base = require("./Base");
const { ChannelTypes } = require("../util/Constants");

class Channel extends Base {
    constructor(client, data, guild = null) {
        super(client);
        this.id = data.id;
        this.type = data.type;
        this.partial = data.partial ?? false;

        if (guild) {
            this.guild = guild;
            this.guildId = guild.id;
        } else if (data.guild_id) {
            this.guildId = data.guild_id;

            this.guild = this.client.guilds.cache.get(data.guild_id) ?? null;
        } else {
            this.guild = null;
            this.guildId = null;
        }

        this._patch(data);
    }

    _patch(data) {
        if ("name" in data) this.name = data.name;

        if ("position" in data) this.position = data.position;
        if ("parent_id" in data) this.parentId = data.parent_id;

        if (this.name) this.partial = false;

        return this;
    }

    static create(client, data, guild = null) {
        let channel = client.channels.cache.get(data.id);

        if (channel && !data.partial) {
            channel._patch(data);
        } else {
            const guildRef = guild || client.guilds.cache.get(data.guild_id);
            let ChannelClass;

            switch (data.type) {
                case ChannelTypes.GUILD_TEXT:
                case ChannelTypes.GUILD_ANNOUNCEMENT:
                    ChannelClass = require("./TextChannel");
                    break;
                case ChannelTypes.DM:
                    ChannelClass = require("./DMChannel");
                    break;
                case ChannelTypes.GUILD_VOICE:
                    ChannelClass = require("./VoiceChannel");
                    break;
                case ChannelTypes.GROUP_DM:
                    client.emit(
                        "debug",
                        `[Channel] Creating base Channel for GroupDM ID: ${data.id}`,
                    );
                    ChannelClass = Channel;
                    break;
                case ChannelTypes.GUILD_CATEGORY:
                    ChannelClass = require("./CategoryChannel");
                    break;
                case ChannelTypes.GUILD_STAGE_VOICE:
                    ChannelClass = require("./StageChannel");
                    break;

                default:
                    client.emit(
                        "warn",
                        `[Channel] Unhandled channel type ${data.type} for channel ${data.id}. Using base Channel structure.`,
                    );
                    ChannelClass = Channel;
                    break;
            }

            if (
                data.type === ChannelTypes.DM ||
                data.type === ChannelTypes.GROUP_DM
            ) {
                channel = new ChannelClass(client, data);
            } else {
                channel = new ChannelClass(client, data, guildRef);
            }
        }
        return channel;
    }

    isTextBased() {
        return [
            ChannelTypes.GUILD_TEXT,
            ChannelTypes.DM,
            ChannelTypes.GROUP_DM,
            ChannelTypes.GUILD_ANNOUNCEMENT,
            ChannelTypes.ANNOUNCEMENT_THREAD,
            ChannelTypes.PUBLIC_THREAD,
            ChannelTypes.PRIVATE_THREAD,
        ].includes(this.type);
    }

    inGuild() {
        return Boolean(this.guildId && this.guild);
    }

    async fetch(force = true) {
        if (!this.partial || force) {
            const data = await this.client.rest.getChannel(this.id);
            this._patch(data);
            this.partial = false;
            return this;
        }
        return this;
    }

    async delete(reason) {
        await this.client.rest.deleteChannel(this.id, { reason });
    }

    toString() {
        return `<#${this.id}>`;
    }
}

module.exports = Channel;
