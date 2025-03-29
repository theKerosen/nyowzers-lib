const BaseCollector = require("./BaseCollector");
const { Events, InteractionTypes } = require("../util/Constants");

class InteractionCollector extends BaseCollector {
    constructor(client, options = {}, context = null) {
        super(client, options);

        this.context = context;
        this.message =
            options.message ??
            (context?.constructor?.name === "Message" ? context : null);
        this.channel =
            options.channel ??
            (context?.constructor?.name === "Channel"
                ? context
                : this.message?.channel);
        this.guild = options.guild ?? this.channel?.guild;

        this.interactionType = options.interactionType;
        this.componentType = options.componentType;

        if (
            !this.message &&
            !this.channel &&
            !this.guild &&
            !options.channelId &&
            !options.guildId &&
            !options.messageId
        ) {
            client.emit(
                "warn",
                "[InteractionCollector] No context (message, channel, guild, or IDs) provided. Collecting interactions globally.",
            );
        }

        this._start();
    }

    _start() {
        if (!this.listenerAttached) {
            this.client.on(Events.INTERACTION_CREATE, this._listener);
            this.listenerAttached = true;
            super._start();
        }
    }

    _cleanup() {
        if (this.listenerAttached) {
            this.client.off(Events.INTERACTION_CREATE, this._listener);
            this.listenerAttached = false;
        }
    }

    collect(interaction) {
        if (this.interactionType && interaction.type !== this.interactionType) {
            return null;
        }

        if (
            interaction.type === InteractionTypes.MESSAGE_COMPONENT &&
            this.componentType &&
            interaction.componentData?.component_type !== this.componentType
        ) {
            return null;
        }

        if (this.guild && interaction.guildId !== this.guild.id) {
            return null;
        }
        if (this.channel && interaction.channelId !== this.channel.id) {
            return null;
        }

        if (this.message && interaction.message?.id !== this.message.id) {
            return null;
        }

        return interaction;
    }
}

module.exports = InteractionCollector;
