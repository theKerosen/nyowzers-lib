const Channel = require("./Channel");
const MessageManager = require("../managers/MessageManager");
const MessageCollector = require("../collectors/MessageCollector");
const InteractionCollector = require("../collectors/InteractionCollector");
const util = require("util");

class TextChannel extends Channel {
    constructor(client, data, guild = null) {
        super(client, data, guild);

        this.messages = new MessageManager(this);
        this._patch(data);
    }

    _patch(data) {
        super._patch(data);

        if ("topic" in data) this.topic = data.topic;
        if ("nsfw" in data) this.nsfw = Boolean(data.nsfw);
        if ("last_message_id" in data)
            this.lastMessageId = data.last_message_id;
        if ("rate_limit_per_user" in data)
            this.rateLimitPerUser = data.rate_limit_per_user;

        return this;
    }

    async send(options) {
        let apiPayload = {};

        if (typeof options === "string") {
            apiPayload.content = options;
        } else if (typeof options === "object" && options !== null) {
            apiPayload = {
                content: options.content,
                embeds: options.embeds?.map((e) => (e.toJSON ? e.toJSON() : e)),
                components: options.components?.map((c) =>
                    c.toJSON ? c.toJSON() : c,
                ),

                message_reference: options.message_reference,

                allowed_mentions: options.allowedMentions,
                files: options.files,
                flags: options.flags,
            };
            Object.keys(apiPayload).forEach(
                (key) =>
                    apiPayload[key] === undefined && delete apiPayload[key],
            );
        } else {
            console.error(
                "[TextChannel.send DEBUG] Invalid options type received:",
                typeof options,
                options,
            );
            throw new TypeError("Invalid message options provided.");
        }

        console.log(
            `[TextChannel.send] Payload for channel ${this.id}:`,
            util.inspect(apiPayload, { depth: 3 }),
        );
        if (
            !apiPayload.content &&
            !apiPayload.embeds?.length &&
            !apiPayload.components
                ?.length /* && !apiPayload.files && !apiPayload.sticker_ids */
        ) {
            console.error(
                `[TextChannel.send ERROR] Payload is effectively empty!`,
                apiPayload,
            );
        }

        const messageData = await this.client.rest.createMessage(
            this.id,
            apiPayload,
        );

        if (!this.messages) {
            /* ... */ return null;
        }

        const addedMessage = this.messages._add(messageData);

        console.log(
            `[TextChannel.send] Returning from _add: ID=${addedMessage?.id}, IsMessage=${addedMessage?.constructor?.name === "Message"}`,
        );

        return addedMessage;
    }

    async sendTyping() {
        await this.client.rest.triggerTyping(this.id);
    }

    createMessageCollector(options = {}) {
        return new MessageCollector(this.client, this, options);
    }

    createInteractionCollector(options = {}) {
        return new InteractionCollector(this.client, options, this);
    }

    get lastMessage() {
        return this.lastMessageId
            ? this.messages.cache.get(this.lastMessageId)
            : null;
    }

    async fetchLastMessage() {
        if (!this.lastMessageId) return null;
        return this.messages.fetch(this.lastMessageId);
    }

    async bulkDelete(messages, filterOld = true) {
        let messageIds = [];
        if (messages instanceof Collection || Array.isArray(messages)) {
            messageIds = messages
                .map((m) => this.messages.resolveId(m))
                .filter(Boolean);
        } else if (typeof messages === "number") {
            const fetched = await this.messages.fetch({ limit: messages });
            messageIds = fetched.map((m) => m.id);
        } else {
            throw new TypeError(
                "Bulk delete expects a Collection, Array, or Number.",
            );
        }

        if (filterOld) {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            messageIds = messageIds.filter((id) => {
                const timestamp = (BigInt(id) >> 22n) + 1420070400000n;
                return timestamp > twoWeeksAgo;
            });
        }

        if (messageIds.length < 2 || messageIds.length > 100) {
            this.client.emit(
                "warn",
                `[Channel] Bulk delete requires between 2 and 100 messages. Provided: ${messageIds.length}`,
            );

            return new Collection();
        }

        await this.client.rest.bulkDeleteMessages(this.id, messageIds);

        return messageIds.reduce(
            (col, id) => col.set(id, { id }),
            new Collection(),
        );
    }
}

module.exports = TextChannel;
