const Interaction = require("./Interaction");

class CommandInteraction extends Interaction {
    constructor(client, data) {
        super(client, data);

        this.commandId = this.commandData?.id;
        this.commandName = this.commandData?.name;
        this.commandType = this.commandData?.type;
        this.options = this.commandData?.options
            ? this._parseOptions(this.commandData.options)
            : [];
        this.resolved = this.commandData?.resolved ?? {};
    }

    _parseOptions(options) {
        return options.map((opt) => ({
            name: opt.name,
            type: opt.type,
            value: opt.value,
            options: opt.options ? this._parseOptions(opt.options) : undefined,
            focused: opt.focused,
        }));
    }

    getString(name, required = false) {
        const option = this.options.find((o) => o.name === name);
        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        return option?.type === 3 /* STRING */ ? option.value : null;
    }
    getInteger(name, required = false) {
        const option = this.options.find((o) => o.name === name);
        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        return option?.type === 4 /* INTEGER */ ? option.value : null;
    }
    getBoolean(name, required = false) {
        const option = this.options.find((o) => o.name === name);

        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        return option?.type === 5 /* BOOLEAN */ ? option.value : null;
    }
    getUser(name, required = false) {
        const option = this.options.find((o) => o.name === name);
        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        const userId = option?.type === 6 /* USER */ ? option.value : null;
        return userId
            ? this.resolved.users?.[userId]
                ? this.client.users._add(this.resolved.users[userId])
                : null
            : null;
    }
    getMember(name, required = false) {
        const option = this.options.find((o) => o.name === name);
        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        const userId = option?.type === 6 /* USER */ ? option.value : null;
        if (!userId || !this.resolved.members?.[userId] || !this.guild)
            return null;

        this.resolved.members[userId].user = this.resolved.users?.[userId] ?? {
            id: userId,
        };
        return this.guild.members._add(this.resolved.members[userId]);
    }
    getChannel(name, required = false) {
        const option = this.options.find((o) => o.name === name);
        if (!option && required)
            throw new Error(`Missing required option: ${name}`);
        const channelId =
            option?.type === 7 /* CHANNEL */ ? option.value : null;
        if (!channelId || !this.resolved.channels?.[channelId]) return null;

        const channelData = this.resolved.channels[channelId];
        channelData.guild_id = this.guildId;
        return this.client.channels._add(channelData, this.guild);
    }

    async respond(choices) {
        if (!this.isAutocomplete())
            throw new Error("Can only respond to autocomplete interactions.");
        if (!Array.isArray(choices))
            throw new TypeError("Choices must be an array.");
        if (this.replied)
            throw new Error("Autocomplete interaction already responded.");

        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: InteractionResponseTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: { choices },
        });
        this.replied = true;
    }
}

module.exports = CommandInteraction;
