const BaseManager = require("./BaseManager");
const Collection = require("../util/Collection");

class ApplicationCommandManager extends BaseManager {
    constructor(client, iterable) {
        super(client, iterable, null, 0);
        this.guild = null;
    }

    forGuild(guildId) {
        const guildManager = new ApplicationCommandManager(this.client);
        guildManager.guild = this.client.guilds.resolve(guildId) ?? {
            id: guildId,
        };
        if (!guildManager.guild)
            throw new Error(`Cannot resolve guild with ID: ${guildId}`);
        return guildManager;
    }

    _getApplicationId() {
        if (!this.client.application?.id) {
            throw new Error(
                "Client application information is not available. Has the client reached READY state?",
            );
        }
        return this.client.application.id;
    }

    /**
     * Fetches commands for the current scope (global or specific guild).
     * @param {boolean} [withLocalizations=false] - Whether to include localization data.
     * @returns {Promise<Collection<string, object>>} - Collection of command data.
     */
    async fetch(withLocalizations = false) {
        const appId = this._getApplicationId();
        let data;
        if (this.guild) {
            data = await this.client.rest.getApplicationGuildCommands(
                appId,
                this.guild.id,
                withLocalizations,
            );
        } else {
            data = await this.client.rest.getApplicationCommands(
                appId,
                withLocalizations,
            );
        }
        const commands = new Collection();
        for (const cmd of data) {
            commands.set(cmd.id, cmd);
        }
        return commands;
    }

    /**
     * Creates a new command in the current scope.
     * @param {SlashCommandBuilder|object} commandData - Command data from builder or raw object.
     * @returns {Promise<object>} - The created command data.
     */
    async create(commandData) {
        const appId = this._getApplicationId();
        const data = commandData.toJSON ? commandData.toJSON() : commandData;

        if (this.guild) {
            return await this.client.rest.createApplicationGuildCommand(
                appId,
                this.guild.id,
                data,
            );
        } else {
            return await this.client.rest.createApplicationCommand(appId, data);
        }
    }

    /**
     * Sets (bulk overwrites) commands for the current scope.
     * @param {Array<SlashCommandBuilder|object>} commandsData - Array of command data.
     * @returns {Promise<Array<object>>} - The command data objects set by Discord.
     */
    async set(commandsData) {
        const appId = this._getApplicationId();

        const data = commandsData.map((cmd) =>
            cmd.toJSON ? cmd.toJSON() : cmd,
        );

        if (this.guild) {
            return await this.client.rest.bulkOverwriteApplicationGuildCommands(
                appId,
                this.guild.id,
                data,
            );
        } else {
            return await this.client.rest.bulkOverwriteApplicationCommands(
                appId,
                data,
            );
        }
    }

    /**
     * Edits an existing command.
     * @param {string} commandId - The ID of the command to edit.
     * @param {SlashCommandBuilder|object} commandData - The new command data.
     * @returns {Promise<object>} - The updated command data.
     */
    async edit(commandId, commandData) {
        const appId = this._getApplicationId();
        const data = commandData.toJSON ? commandData.toJSON() : commandData;

        if (this.guild) {
            return await this.client.rest.editApplicationGuildCommand(
                appId,
                this.guild.id,
                commandId,
                data,
            );
        } else {
            return await this.client.rest.editApplicationCommand(
                appId,
                commandId,
                data,
            );
        }
    }

    /**
     * Deletes a command.
     * @param {string} commandId - The ID of the command to delete.
     * @returns {Promise<void>}
     */
    async delete(commandId) {
        const appId = this._getApplicationId();

        if (this.guild) {
            await this.client.rest.deleteApplicationGuildCommand(
                appId,
                this.guild.id,
                commandId,
            );
        } else {
            await this.client.rest.deleteApplicationCommand(appId, commandId);
        }
    }
}

module.exports = ApplicationCommandManager;
