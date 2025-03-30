const { APIVersion } = require("../util/Constants");
const baseURL = `/api/v${APIVersion}`;

const Routes = {
    gateway: () => `/gateway`,
    gatewayBot: () => `/gateway/bot`,

    user: (userId) => `/users/${userId}`,
    currentUser: () => `/users/@me`,
    currentUserGuilds: () => `/users/@me/guilds`,

    guilds: () => `/guilds`,
    guild: (guildId) => `/guilds/${guildId}`,
    guildChannels: (guildId) => `/guilds/${guildId}/channels`,
    guildMembers: (guildId) => `/guilds/${guildId}/members`,
    guildMember: (guildId, userId) => `/guilds/${guildId}/members/${userId}`,

    channels: () => `/channels`,
    channel: (channelId) => `/channels/${channelId}`,
    channelMessages: (channelId) => `/channels/${channelId}/messages`,
    channelMessage: (channelId, messageId) =>
        `/channels/${channelId}/messages/${messageId}`,
    channelTyping: (channelId) => `/channels/${channelId}/typing`,
    channelMessageReactions: (channelId, messageId) =>
        `/channels/${channelId}/messages/${messageId}/reactions`,
    channelMessageReaction: (channelId, messageId, emoji) =>
        `/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
    channelMessageReactionUser: (channelId, messageId, emoji, userId = "@me") =>
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/${userId}`,
    channelMessagesBulkDelete: (channelId) =>
        `/channels/${channelId}/messages/bulk-delete`,

    interactionCallback: (interactionId, interactionToken) =>
        `/interactions/${interactionId}/${interactionToken}/callback`,

    webhookMessages: (applicationId, interactionToken) =>
        `/webhooks/${applicationId}/${interactionToken}/messages`, // POST here for followups
    webhookMessage: (
        applicationId,
        interactionToken,
        messageId = "@original",
    ) => `/webhooks/${applicationId}/${interactionToken}/messages/${messageId}`,

    currentApplication: () => "/oauth2/applications/@me",

    applications: () => `/applications`,
    applicationCommands: (applicationId) =>
        `/applications/${applicationId}/commands`,
    applicationCommand: (applicationId, commandId) =>
        `/applications/${applicationId}/commands/${commandId}`,

    applicationGuildCommands: (applicationId, guildId) =>
        `/applications/${applicationId}/guilds/${guildId}/commands`,
    applicationGuildCommand: (applicationId, guildId, commandId) =>
        `/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,
    applicationGuildCommandPermissions: (applicationId, guildId, commandId) =>
        `/applications/${applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
    guildApplicationCommandsPermissions: (applicationId, guildId) =>
        `/applications/${applicationId}/guilds/${guildId}/commands/permissions`,

    webhooks: (webhookId) => `/webhooks/${webhookId}`,
    webhookToken: (webhookId, webhookToken) =>
        `/webhooks/${webhookId}/${webhookToken}`,
};

const RouteProxy = new Proxy(Routes, {
    get(target, prop) {
        if (prop in target) {
            return (...args) => `${baseURL}${target[prop](...args)}`;
        }
        return undefined;
    },
});

module.exports = RouteProxy;
