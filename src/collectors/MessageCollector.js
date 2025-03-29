const BaseCollector = require("./BaseCollector");
const { Events } = require("../util/Constants");

class MessageCollector extends BaseCollector {
    constructor(client, channel, options = {}) {
        super(client, options);
        this.channel = channel;

        if (!this.channel || !this.channel.id) {
            throw new Error("Invalid channel provided for MessageCollector.");
        }

        this._start();
    }

    _start() {
        if (!this.listenerAttached) {
            this.client.on(Events.MESSAGE_CREATE, this._listener);
            this.listenerAttached = true;
            super._start();
        }
    }

    _cleanup() {
        if (this.listenerAttached) {
            this.client.off(Events.MESSAGE_CREATE, this._listener);
            this.listenerAttached = false;
        }
    }

    collect(message) {
        if (message.channelId !== this.channel.id) return null;

        if (!message.channel) message.channel = this.channel;
        return message;
    }
}

module.exports = MessageCollector;
