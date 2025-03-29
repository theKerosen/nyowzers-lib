const { Events } = require("../util/Constants");
const Message = require("../structures/Message");
const Interaction = require("../structures/Interaction");
const CommandInteraction = require("../structures/CommandInteraction");
const ButtonInteraction = require("../structures/ButtonInteraction");
const {
    InteractionTypes,
    ComponentTypes,
    InteractionResponseTypes,
} = require("../util/Constants");
const util = require("util");

class GatewayEventHandler {
    constructor(client, wsManager) {
        this.client = client;
        this.ws = wsManager;
    }

    handle(packet) {
        const { t: eventName, d: data } = packet;

        switch (eventName) {
            case "READY":
                this._handleReady(data);
                break;
            case "GUILD_CREATE":
                this._handleGuildCreate(data);
                break;
            case "GUILD_UPDATE":
                this._handleGuildUpdate(data);
                break;
            case "GUILD_DELETE":
                this._handleGuildDelete(data);
                break;
            case "MESSAGE_CREATE":
                this._handleMessageCreate(data);
                break;
            case "MESSAGE_UPDATE":
                this._handleMessageUpdate(data);
                break;
            case "MESSAGE_DELETE":
                this._handleMessageDelete(data);
                break;
            case "INTERACTION_CREATE":
                this._handleInteractionCreate(data);
                break;

            default:
                this.client.emit(
                    "debug",
                    `[EventHandler] Unhandled event: ${eventName}`,
                );
        }
    }

    _handleReady(data) {
        this.ws.sessionId = data.session_id;
        this.ws.resumeGatewayUrl = data.resume_gateway_url;
        this.client.user = this.client.users._add(data.user);

        for (const guildData of data.guilds) {
            guildData.unavailable = true;
            this.client.guilds._add(guildData, true);
        }

        this.ws.status = "ready";
        this.client.emit(Events.WS_READY);
        this.client.ready = true;
        this.client.readyAt = new Date();
        this.client.emit(Events.READY);
        this.client.emit(
            "debug",
            `[EventHandler] Received READY. Session: ${this.ws.sessionId}`,
        );
    }

    _handleGuildCreate(data) {
        let guild = this.client.guilds.cache.get(data.id);

        if (guild && guild.unavailable) {
            guild = this.client.guilds._add(data, true);
            this.client.emit(
                "debug",
                `[EventHandler] Guild ${data.id} became available.`,
            );
        } else if (!guild) {
            guild = this.client.guilds._add(data, true);
            this.client.emit(Events.GUILD_CREATE, guild);
            this.client.emit(
                "debug",
                `[EventHandler] Joined new Guild ${data.id}.`,
            );
        } else {
            this.client.emit(
                "debug",
                `[EventHandler] Received GUILD_CREATE for already cached guild ${data.id}. Ignoring duplicate.`,
            );
        }

        if (guild && !guild.unavailable) {
            if (data.channels) {
                for (const channelData of data.channels) {
                    channelData.guild_id = guild.id;
                    this.client.channels._add(channelData, guild);
                }
            }
        }
    }

    _handleGuildUpdate(data) {
        const oldGuild =
            this.client.guilds.cache.get(data.id)?._clone() ?? null;
        const newGuild = this.client.guilds._add(data);
        this.client.emit(Events.GUILD_UPDATE, oldGuild, newGuild);
    }

    _handleGuildDelete(data) {
        const guild = this.client.guilds.cache.get(data.id);
        this.client.guilds.cache.delete(data.id);

        this.client.channels.cache.sweep((c) => c.guildId === data.id);

        if (guild && !guild.unavailable) {
            this.client.emit(Events.GUILD_DELETE, guild);
        } else {
            guild.unavailable = true;
            this.client.emit("guildUnavailable", guild);
        }
    }

    _handleMessageCreate(data) {
        const channel = this.client.channels.cache.get(data.channel_id);
        const author = this.client.users._add(data.author);

        let member = null;
        if (channel?.guild && data.member) {
            data.member.user = data.author;
            member = channel.guild.members._add(data.member);
        }

        const message = new Message(this.client, data);

        if (channel && channel.messages) {
            channel.messages._add(message);
        }

        this.client.emit(Events.MESSAGE_CREATE, message);
    }

    _handleMessageUpdate(data) {
        const channel = this.client.channels.cache.get(data.channel_id);
        let oldMessage = null;
        if (channel && channel.messages) {
            oldMessage = channel.messages.cache.get(data.id)?._clone() ?? null;
        }

        const newMessage =
            channel?.messages?._add(data) ?? new Message(this.client, data);

        this.client.emit(Events.MESSAGE_UPDATE, oldMessage, newMessage);
    }

    _handleMessageDelete(data) {
        const channel = this.client.channels.cache.get(data.channel_id);
        const deletedMessage = channel?.messages?.cache.get(data.id) ?? null;

        if (deletedMessage) {
            channel.messages.cache.delete(data.id);
            this.client.emit(Events.MESSAGE_DELETE, deletedMessage);
        } else {
            this.client.emit(Events.MESSAGE_DELETE, {
                id: data.id,
                channelId: data.channel_id,
                guildId: data.guild_id,
                partial: true,
            });
        }
    }

    _handleInteractionCreate(data) {
        let interaction;

        if (!data || !data.type) {
            this.client.emit(
                "warn",
                `[EventHandler] Received INTERACTION_CREATE with invalid payload structure: ${util.inspect(data)}`,
            );
            return;
        }
        const interactionData = data.data;

        try {
            switch (data.type) {
                case InteractionTypes.APPLICATION_COMMAND:
                    interaction = new CommandInteraction(this.client, data);
                    break;
                case InteractionTypes.MESSAGE_COMPONENT:
                    if (
                        !interactionData ||
                        typeof interactionData.component_type === "undefined"
                    ) {
                        this.client.emit(
                            "warn",
                            `[EventHandler] Received MESSAGE_COMPONENT interaction with missing data or component_type: ${util.inspect(data)}`,
                        );
                        interaction = new Interaction(this.client, data);
                        break;
                    }

                    switch (interactionData.component_type) {
                        case ComponentTypes.BUTTON:
                            interaction = new ButtonInteraction(
                                this.client,
                                data,
                            );
                            break;

                        default:
                            this.client.emit(
                                "warn",
                                `[EventHandler] Unhandled component type: ${interactionData.component_type}`,
                            );
                            interaction = new Interaction(this.client, data);
                            break;
                    }
                    break;

                case InteractionTypes.PING:
                    interaction = new Interaction(this.client, data);

                    this.client.rest
                        .createInteractionResponse(data.id, data.token, {
                            type: InteractionResponseTypes.PONG,
                        })
                        .catch((err) =>
                            this.client.emit(
                                "warn",
                                `[EventHandler] Failed to respond to PING interaction: ${err.message}`,
                            ),
                        );

                    return;

                default:
                    this.client.emit(
                        "warn",
                        `[EventHandler] Unhandled interaction type: ${data.type}`,
                    );
                    interaction = new Interaction(this.client, data);
                    break;
            }

            if (interaction) {
                this.client.emit(Events.INTERACTION_CREATE, interaction);
            }
        } catch (error) {
            this.client.emit(
                "error",
                new Error(
                    `[EventHandler] Failed to instantiate Interaction (Type ${data.type}): ${error.message}\nPayload: ${util.inspect(data)}`,
                ),
            );
            console.error(error);
        }
    }
}

module.exports = GatewayEventHandler;
