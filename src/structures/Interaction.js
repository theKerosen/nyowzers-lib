const Base = require("./Base");
const Message = require("./Message");
const Constants = require("../util/Constants");
const util = require("util");

class Interaction extends Base {
    constructor(client, data) {
        super(client);
        this.id = data.id;
        this.applicationId = data.application_id;
        this.type = data.type;
        this.token = data.token;
        this.version = data.version;
        this.guildId = data.guild_id;
        this.channelId = data.channel_id;
        this.locale = data.locale;
        this.guildLocale = data.guild_locale;

        this.guild = this.guildId
            ? (this.client.guilds.cache.get(this.guildId) ?? null)
            : null;
        this.channel = this.channelId
            ? (this.client.channels.cache.get(this.channelId) ?? null)
            : null;

        if (data.member && this.guild) {
            if (data.member.user) {
                this.user = this.client.users._add(data.member.user);
            } else if (data.user) {
                this.user = this.client.users._add(data.user);
                data.member.user = data.user;
            } else {
                this.user = null;
            }
            this.member = this.guild.members._add(data.member);
        } else if (data.user) {
            this.user = this.client.users._add(data.user);
            this.member = null;
        } else {
            this.user = null;
            this.member = null;
        }

        this.deferred = false;
        this.replied = false;

        this.commandData = data.data ?? null;
        this.componentData = data.data ?? null;
        this.modalData = data.data ?? null;

        this.message = data.message ? new Message(client, data.message) : null;
    }

    isCommand() {
        return this.type === Constants.InteractionTypes.APPLICATION_COMMAND;
    }
    isButton() {
        return (
            this.type === Constants.InteractionTypes.MESSAGE_COMPONENT &&
            this.componentData?.component_type ===
                Constants.ComponentTypes.BUTTON
        );
    }
    isSelectMenu() {
        return (
            this.type === InteractionTypes.MESSAGE_COMPONENT &&
            [
                ComponentTypes.STRING_SELECT,
                ComponentTypes.USER_SELECT,
                ComponentTypes.ROLE_SELECT,
                ComponentTypes.MENTIONABLE_SELECT,
                ComponentTypes.CHANNEL_SELECT,
            ].includes(this.componentData?.component_type)
        );
    }
    isModalSubmit() {
        return this.type === InteractionTypes.MODAL_SUBMIT;
    }
    isAutocomplete() {
        return this.type === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE;
    }
    isPing() {
        return this.type === InteractionTypes.PING;
    }

    async reply(options) {
        if (this.deferred || this.replied) {
            return this.followUp(options);
        }

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
                flags: options.ephemeral ? 1 << 6 : options.flags,
            };
        } else {
            throw new TypeError("Invalid reply options provided.");
        }

        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: Constants.InteractionResponseTypes
                .CHANNEL_MESSAGE_WITH_SOURCE,
            data: payload,
        });
        this.replied = true;
    }

    async deferReply({ ephemeral = false } = {}) {
        if (this.deferred || this.replied)
            throw new Error("Interaction already acknowledged.");

        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: Constants.InteractionResponseTypes
                .DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: ephemeral ? { flags: 1 << 6 } : {},
        });
        this.deferred = true;
    }

    async editReply(options) {
        if (!this.replied && !this.deferred)
            throw new Error(
                "Interaction has not been previously acknowledged.",
            );

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
            };
        } else {
            throw new TypeError("Invalid edit options provided.");
        }

        const messageData =
            await this.client.rest.editOriginalInteractionResponse(
                this.client.user.id,
                this.token,
                payload,
            );

        return messageData;
    }

    async deleteReply() {
        if (!this.replied && !this.deferred)
            throw new Error(
                "Interaction has not been previously acknowledged.",
            );
        await this.client.rest.deleteOriginalInteractionResponse(
            this.client.user.id,
            this.token,
        );
    }

    async followUp(options) {
        if (!this.replied && !this.deferred)
            throw new Error(
                "Interaction must be acknowledged before sending followup messages.",
            );

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
                flags: options.ephemeral ? 1 << 6 : options.flags,
            };
        } else {
            throw new TypeError("Invalid followup options provided.");
        }

        const messageData = await this.client.rest.createFollowupMessage(
            this.client.user.id,
            this.token,
            payload,
        );

        const channel =
            this.channel ?? (await this.client.channels.fetch(this.channelId));
        return (
            channel?.messages?._add(messageData) ??
            new Message(this.client, messageData)
        );
    }

    async deferUpdate() {
        if (!this.isButton() && !this.isSelectMenu())
            throw new Error(
                "deferUpdate can only be used on component interactions.",
            );
        if (this.deferred || this.replied)
            throw new Error("Interaction already acknowledged.");

        console.log(
            "[DEBUG deferUpdate] Checking Constants.InteractionResponseTypes:",
            util.inspect(Constants.InteractionResponseTypes),
        );

        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: Constants.InteractionResponseTypes.DEFERRED_UPDATE_MESSAGE,
        });
        this.deferred = true;
    }

    async update(options) {
        if (!this.isButton() && !this.isSelectMenu())
            throw new Error(
                "update can only be used on component interactions.",
            );
        if (this.deferred || this.replied)
            throw new Error("Interaction already acknowledged.");

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
            };
        } else {
            throw new TypeError("Invalid update options provided.");
        }

        console.log(
            "[DEBUG update] Checking Constants.InteractionResponseTypes:",
            util.inspect(Constants.InteractionResponseTypes),
        );

        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: Constants.InteractionResponseTypes.UPDATE_MESSAGE,
            data: payload,
        });
        this.replied = true;
    }

    async fetchReply() {
        if (!this.replied && !this.deferred)
            throw new Error("Interaction has not been acknowledged yet.");

        const messageData =
            await this.client.rest.getOriginalInteractionResponse(
                this.client.user.id,
                this.token,
            );
        const channel =
            this.channel ?? (await this.client.channels.fetch(this.channelId));
        return (
            channel?.messages?._add(messageData) ??
            new Message(this.client, messageData)
        );
    }
}

module.exports = Interaction;
