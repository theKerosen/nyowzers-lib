const Base = require("./Base");
const Collection = require("../util/Collection");
const InteractionCollector = require("../collectors/InteractionCollector");
const { MessageFlags } = require("../util/Constants");

class Message extends Base {
    constructor(client, data) {
        super(client);
        this.id = data.id;
        this.channelId = data.channel_id;
        this.guildId = data.guild_id;
        this.partial = data.partial ?? !data.author;

        this.channel = this.client.channels.cache.get(this.channelId) ?? null;
        this.guild =
            this.client.guilds.cache.get(this.guildId) ??
            this.channel?.guild ??
            null;

        if (data.author) {
            this.author = this.client.users._add(data.author);
        } else {
            this.author = null;
        }

        if (this.guild && data.member) {
            data.member.user = data.author;
            this.member = this.guild.members._add(data.member);
        } else if (this.guild && this.author) {
            this.member = this.guild.members.cache.get(this.author.id) ?? null;
        } else {
            this.member = null;
        }

        this._patch(data);
    }

    _patch(data) {
        if ("content" in data) this.content = data.content;
        if ("timestamp" in data)
            this.createdTimestamp = Date.parse(data.timestamp);
        if ("edited_timestamp" in data)
            this.editedTimestamp = data.edited_timestamp
                ? Date.parse(data.edited_timestamp)
                : null;
        if ("tts" in data) this.tts = data.tts;
        if ("mention_everyone" in data)
            this.mentionEveryone = data.mention_everyone;

        if (!this.mentions) {
            this.mentions = {
                users: new Collection(),
                roles: [],
                channels: new Collection(),
            };
        }

        if ("mention_roles" in data)
            this.mentions.roles = data.mention_roles || [];

        if (data.mentions && Array.isArray(data.mentions)) {
            this.mentions.users.clear();

            for (const mentionData of data.mentions) {
                if (mentionData?.id) {
                    const user = this.client.users._add(mentionData);
                    this.mentions.users.set(user.id, user);
                    if (this.guild && mentionData.member) {
                        mentionData.member.user = mentionData;
                        this.guild.members._add(mentionData.member);
                    }
                } else {
                    this.client.emit(
                        "warn",
                        `[Message Patch] Received invalid mention data inside mentions array: ${mentionData}`,
                    );
                }
            }
        }
    }
    get createdAt() {
        return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
    }

    get editedAt() {
        return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
    }

    get isPartial() {
        return this.partial;
    }

    inGuild() {
        return Boolean(this.guildId && this.guild);
    }

    async reply(options) {
        let payload = {};
        let messageOptions = {};

        if (typeof options === "string") {
            payload.content = options;
        } else if (typeof options === "object" && options !== null) {
            payload = {
                content: options.content,
                embeds: options.embeds,
                components: options.components,
                allowed_mentions: options.allowedMentions ?? {
                    replied_user: options.failIfNotExists ?? true,
                },
                files: options.files,
                flags: options.flags,
            };
            messageOptions = {
                failIfNotExists: options.failIfNotExists,
            };
        } else {
            throw new TypeError("Invalid reply options provided.");
        }

        payload.message_reference = {
            message_id: this.id,
            channel_id: this.channelId,
            guild_id: this.guildId,
            fail_if_not_exists: messageOptions.failIfNotExists,
        };

        if (!this.channel?.send) {
            const fetchedChannel = await this.client.channels
                .fetch(this.channelId)
                .catch(() => null);
            if (!fetchedChannel?.send) {
                throw new Error(
                    "Cannot reply: Channel not found or is not text-based.",
                );
            }
            this.channel = fetchedChannel;
        }

        const sentMessage = await this.channel.send(payload);

        return sentMessage;
    }

    async edit(options) {
        if (this.author?.id !== this.client.user?.id) {
            throw new Error("Cannot edit message authored by another user.");
        }
        if (!this.channel?.messages?.edit)
            throw new Error(
                "Cannot edit without a valid channel/message manager reference.",
            );

        return this.channel.messages.edit(this.id, options);
    }

    async delete({ reason } = {}) {
        if (!this.channel?.messages?.delete)
            throw new Error(
                "Cannot delete without a valid channel/message manager reference.",
            );

        await this.channel.messages.delete(this.id);
    }

    async react(emoji) {
        const encodedEmoji =
            typeof emoji === "string"
                ? encodeURIComponent(emoji)
                : `${encodeURIComponent(emoji.name)}:${emoji.id}`;
        if (!encodedEmoji) throw new Error("Invalid emoji provided.");

        await this.client.rest.createReaction(
            this.channelId,
            this.id,
            encodedEmoji,
        );
    }

    createMessageComponentCollector(options = {}) {
        const filter = options.filter;
        options.filter = (interaction) => {
            if (interaction.message?.id !== this.id) return false;
            return filter ? filter(interaction) : true;
        };
        return new InteractionCollector(this.client, options, this);
    }

    async fetch(force = true) {
        if (!this.partial || force) {
            const updatedMessage = await this.channel?.messages?.fetch(this.id);
            if (updatedMessage) {
                this._patch(updatedMessage);
                this.partial = false;
            }
            return this;
        }
        return this;
    }

    toString() {
        return this.content ?? "";
    }

    hasFlag(flag) {
        const flagValue = typeof flag === "string" ? MessageFlags[flag] : flag;
        return Boolean(this.flags & flagValue);
    }
}

module.exports = Message;
