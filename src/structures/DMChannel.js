const Channel = require("./Channel");
const MessageManager = require("../managers/MessageManager");
const User = require("./User");
const Collection = require("../util/Collection");

class DMChannel extends Channel {
    constructor(client, data) {
        super(client, data, null);
        this.messages = new MessageManager(this);
        this.recipient = null;

        if (data.recipients && Array.isArray(data.recipients)) {
            const recipientData = data.recipients.find(
                (r) => r.id !== this.client.user?.id,
            );
            if (recipientData) {
                this.recipient = this.client.users._add(recipientData);
            }
        }

        this._patch(data);
    }

    _patch(data) {
        super._patch(data);
        if ("last_message_id" in data)
            this.lastMessageId = data.last_message_id;

        if (
            !this.recipient &&
            data.recipients &&
            Array.isArray(data.recipients)
        ) {
            const recipientData = data.recipients.find(
                (r) => r.id !== this.client.user?.id,
            );
            if (recipientData) {
                this.recipient = this.client.users._add(recipientData);
            }
        }
        return this;
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
}

module.exports = DMChannel;
