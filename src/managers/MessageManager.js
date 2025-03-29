const BaseManager = require("./BaseManager");
const Message = require("../structures/Message");
const Collection = require("../util/Collection");

class MessageManager extends BaseManager {
    constructor(channel) {
        super(channel.client, null, Message, "messageCacheLimit");
        this.channel = channel;
    }

    _add(data, cache = true) {
        if (!data || !data.id) {
            console.error(
                "[FATAL MessageManager._add] Received invalid or missing data:",
                data,
            );
            return null;
        }

        const existing = this.cache.get(data.id);
        if (existing && cache) {
            return existing._patch(data);
        }

        let message;
        try {
            message = new Message(this.client, data);
        } catch (constructorError) {
            console.error(
                `[FATAL MessageManager._add] Error during 'new Message()':`,
                constructorError,
            );
            console.error(`Data passed to constructor:`, util.inspect(data));
            return null;
        }

        if (!message || !(message instanceof Message)) {
            console.error(
                `[FATAL MessageManager._add] 'new Message()' did not return a valid Message instance! Returned:`,
                message,
            );
            return null;
        }

        if (cache) {
            if (this.cacheLimit > 0 && this.cache.size >= this.cacheLimit) {
                this.cache.delete(this.cache.firstKey());
            }
            this.cache.set(message.id, message);
        }

        return message;
    }

    resolveId(resolvable) {
        if (resolvable instanceof Message) return resolvable.id;
        if (typeof resolvable === "string") return resolvable;
        return null;
    }

    async fetch(options) {
        if (typeof options === "string") {
            const id = options;

            if (this.cacheLimit > 0) {
                const existing = this.cache.get(id);
                if (existing && !existing.partial) return existing;
            }

            try {
                const data = await this.client.rest.getChannelMessage(
                    this.channel.id,
                    id,
                );

                return this._add(data, this.cacheLimit > 0);
            } catch (error) {
                if (error.status === 404) {
                    this.cache.delete(id);
                    return null;
                }
                throw error;
            }
        } else if (typeof options === "object" && options !== null) {
            const { limit = 50, before, after, around } = options;
            const query = new URLSearchParams({ limit });

            if (before) query.set("before", this.resolveId(before));
            if (after) query.set("after", this.resolveId(after));
            if (around) query.set("around", this.resolveId(around));

            const dataArray = await this.client.rest.getChannelMessages(
                this.channel.id,
                query,
            );
            const results = new Collection();
            for (const msgData of dataArray) {
                const message = this._add(msgData, this.cacheLimit > 0);
                results.set(message.id, message);
            }
            return results;
        } else {
            const dataArray = await this.client.rest.getChannelMessages(
                this.channel.id,
                new URLSearchParams({ limit: 50 }),
            );
            const results = new Collection();
            for (const msgData of dataArray) {
                const message = this._add(msgData, this.cacheLimit > 0);
                results.set(message.id, message);
            }
            return results;
        }
    }

    async delete(messageResolvable, reason) {
        const messageId = this.resolveId(messageResolvable);
        if (!messageId)
            throw new Error("Invalid message resolvable provided for delete.");

        await this.client.rest.deleteMessage(this.channel.id, messageId, {
            reason,
        });
    }

    async edit(messageResolvable, options) {
        const messageId = this.resolveId(messageResolvable);
        if (!messageId)
            throw new Error("Invalid message resolvable provided for edit.");

        let payload = {};
        if (typeof options === "string") {
            payload.content = options;
        } else if (typeof options === "object" && options !== null) {
            payload = {
                content: options.content,
                embeds: options.embeds,
                components: options.components,
                allowed_mentions: options.allowedMentions,
                files: options.files,
                flags: options.flags,
            };
        } else {
            throw new TypeError("Invalid message edit options provided.");
        }

        const data = await this.client.rest.editMessage(
            this.channel.id,
            messageId,
            payload,
        );
        return this._add(data);
    }
}

module.exports = MessageManager;
