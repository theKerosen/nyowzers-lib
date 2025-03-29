const {
    ApplicationCommandTypes,
    ApplicationCommandOptionTypes,
} = require("../util/Constants");

class SlashCommandBuilder {
    constructor() {
        this.data = {
            type: ApplicationCommandTypes.CHAT_INPUT,
            name: undefined,
            description: undefined,
            options: [],
        };
    }

    setType(type) {
        this.data.type = type;
        return this;
    }

    setName(name) {
        this.data.name = name;
        return this;
    }

    setDescription(description) {
        this.data.description = description;
        return this;
    }

    addStringOption(input) {
        const option = { type: ApplicationCommandOptionTypes.STRING, ...input };

        this.data.options.push(option);
        return this;
    }

    addIntegerOption(input) {
        const option = {
            type: ApplicationCommandOptionTypes.INTEGER,
            ...input,
        };

        this.data.options.push(option);
        return this;
    }

    addBooleanOption(input) {
        const option = {
            type: ApplicationCommandOptionTypes.BOOLEAN,
            ...input,
        };
        this.data.options.push(option);
        return this;
    }

    addUserOption(input) {
        const option = { type: ApplicationCommandOptionTypes.USER, ...input };
        this.data.options.push(option);
        return this;
    }

    addChannelOption(input) {
        const option = {
            type: ApplicationCommandOptionTypes.CHANNEL,
            ...input,
        };

        this.data.options.push(option);
        return this;
    }

    addRoleOption(input) {
        const option = { type: ApplicationCommandOptionTypes.ROLE, ...input };
        this.data.options.push(option);
        return this;
    }

    addMentionableOption(input) {
        const option = {
            type: ApplicationCommandOptionTypes.MENTIONABLE,
            ...input,
        };
        this.data.options.push(option);
        return this;
    }

    addNumberOption(input) {
        const option = { type: ApplicationCommandOptionTypes.NUMBER, ...input };
        this.data.options.push(option);
        return this;
    }

    addAttachmentOption(input) {
        const option = {
            type: ApplicationCommandOptionTypes.ATTACHMENT,
            ...input,
        };
        this.data.options.push(option);
        return this;
    }

    setDefaultMemberPermissions(permissions) {
        this.data.default_member_permissions = permissions?.toString() ?? null;
        return this;
    }

    setDMPermission(enabled = true) {
        this.data.dm_permission = enabled;
        return this;
    }

    toJSON() {
        if (!this.data.name) throw new Error("Command name is required.");
        if (
            this.data.type === ApplicationCommandTypes.CHAT_INPUT &&
            !this.data.description
        ) {
            throw new Error("Chat input commands require a description.");
        }

        return { ...this.data };
    }
}

module.exports = SlashCommandBuilder;
