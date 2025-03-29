const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { Host } = require("../util/Constants");
const Router = require("./Router");
const pkg = require("../package.json");

class RESTManager {
    constructor(client) {
        this.client = client;
        this.userAgent = `DiscordBot (${pkg.repository?.url || "unknown"}, ${pkg.version}) Node.js/${process.version}`;
        this.globalRateLimit = { limited: false, retryAfter: 0 };
        this.bucketRateLimits = new Map();
        this.requestQueue = [];
        this.processingQueue = false;
    }

    async queueRequest(method, route, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                method,
                route,
                endpoint,
                data,
                resolve,
                reject,
            });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.processingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.processingQueue = true;

        const { method, route, endpoint, data, resolve, reject } =
            this.requestQueue.shift();

        try {
            while (
                this.globalRateLimit.limited &&
                this.globalRateLimit.retryAfter > Date.now()
            ) {
                const delay = this.globalRateLimit.retryAfter - Date.now();
                this.client.emit(
                    "warn",
                    `[REST] Global rate limit hit. Waiting ${delay}ms.`,
                );
                await new Promise((res) => setTimeout(res, delay));
            }

            const bucket = this.bucketRateLimits.get(route);
            if (
                bucket &&
                bucket.remaining <= 0 &&
                bucket.resetAt > Date.now()
            ) {
                const delay = bucket.resetAt - Date.now();
                this.client.emit(
                    "warn",
                    `[REST] Bucket ${route} rate limit hit. Waiting ${delay}ms.`,
                );
                await new Promise((res) => setTimeout(res, delay));

                this.requestQueue.unshift({
                    method,
                    route,
                    endpoint,
                    data,
                    resolve,
                    reject,
                });
                this.processingQueue = false;
                this._processQueue();
                return;
            }

            const result = await this._makeRequest(
                method,
                route,
                endpoint,
                data,
            );
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processingQueue = false;
            this._processQueue();
        }
    }

    async _makeRequest(method, route, endpoint, body) {
        const url = `${Host}${endpoint}`;
        const headers = {
            Authorization: `Bot ${this.client.token}`,
            "User-Agent": this.userAgent,
            "Accept-Encoding": "gzip,deflate",
        };
        let stringifiedBody = null;
        if (body) {
            headers["Content-Type"] = "application/json";

            stringifiedBody = JSON.stringify(body, (key, value) =>
                typeof value === "bigint" ? value.toString() : value,
            );
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            this.client.options.restRequestTimeout || 15000,
        );

        let response;
        try {
            response = await fetch(url, {
                method: method,
                headers: headers,

                body: stringifiedBody,
                signal: controller.signal,
                compress: true,
            });
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === "AbortError") {
                this.client.emit(
                    "error",
                    new Error(`[REST] Request to ${endpoint} timed out.`),
                );
                throw new Error("Request timed out");
            }
            this.client.emit(
                "error",
                new Error(
                    `[REST] Network error fetching ${endpoint}: ${error.message}`,
                ),
            );
            throw error;
        } finally {
            clearTimeout(timeout);
        }

        const remaining = response.headers.get("x-ratelimit-remaining");
        const limit = response.headers.get("x-ratelimit-limit");
        const resetAfter = response.headers.get("x-ratelimit-reset-after");
        const bucketId = response.headers.get("x-ratelimit-bucket");
        const isGlobal = response.headers.get("x-ratelimit-global");

        if (bucketId && limit && remaining && resetAfter) {
            this.bucketRateLimits.set(bucketId, {
                limit: parseInt(limit),
                remaining: parseInt(remaining),
                resetAt: Date.now() + parseFloat(resetAfter) * 1000,
            });
        } else if (limit && remaining && resetAfter) {
            this.bucketRateLimits.set(route, {
                limit: parseInt(limit),
                remaining: parseInt(remaining),
                resetAt: Date.now() + parseFloat(resetAfter) * 1000,
            });
        }

        if (isGlobal === "true") {
            const retryAfter =
                parseInt(response.headers.get("retry-after") || "1") * 1000;
            this.globalRateLimit = {
                limited: true,
                retryAfter: Date.now() + retryAfter,
            };
            this.client.emit(
                "warn",
                `[REST] Global rate limit encountered. Retry after ${retryAfter}ms.`,
            );
        } else {
            this.globalRateLimit = { limited: false, retryAfter: 0 };
        }

        if (response.status === 429) {
            const retryAfter =
                parseInt(response.headers.get("retry-after") || "1") * 1000;
            this.client.emit(
                "warn",
                `[REST] 429 Rate Limited on route ${route}. Retrying after ${retryAfter}ms.`,
            );

            await new Promise((res) => setTimeout(res, retryAfter));

            return this._makeRequest(method, route, endpoint, body);
        }

        let responseBody;
        if (
            response.headers.get("content-type")?.includes("application/json")
        ) {
            responseBody = await response.json();
        } else {
            responseBody = await response.buffer();
        }

        if (!response.ok) {
            const error = new Error(
                `Discord API Error: ${response.status} ${response.statusText} on ${method} ${endpoint}`,
            );
            error.status = response.status;
            error.method = method;
            error.endpoint = endpoint;
            error.responseBody = responseBody;
            this.client.emit("error", error);
            throw error;
        }

        if (response.status === 204) {
            return null;
        }

        return responseBody;
    }

    getGateway() {
        return this.queueRequest("GET", Router.gateway(), Router.gateway());
    }
    getGatewayBot() {
        return this.queueRequest(
            "GET",
            Router.gatewayBot(),
            Router.gatewayBot(),
        );
    }

    getUser(userId) {
        return this.queueRequest(
            "GET",
            Router.user(":id"),
            Router.user(userId),
        );
    }
    getCurrentUser() {
        return this.queueRequest(
            "GET",
            Router.currentUser(),
            Router.currentUser(),
        );
    }
    getCurrentUserGuilds() {
        return this.queueRequest(
            "GET",
            Router.currentUserGuilds(),
            Router.currentUserGuilds(),
        );
    }

    getGuild(guildId) {
        return this.queueRequest(
            "GET",
            Router.guild(":id"),
            Router.guild(guildId),
        );
    }
    getGuildChannels(guildId) {
        return this.queueRequest(
            "GET",
            Router.guildChannels(":id"),
            Router.guildChannels(guildId),
        );
    }
    getGuildMembers(guildId) {
        return this.queueRequest(
            "GET",
            Router.guildMembers(":id"),
            Router.guildMembers(guildId),
        );
    }
    getGuildMember(guildId, userId) {
        return this.queueRequest(
            "GET",
            Router.guildMember(":id", ":id"),
            Router.guildMember(guildId, userId),
        );
    }

    getChannel(channelId) {
        return this.queueRequest(
            "GET",
            Router.channel(":id"),
            Router.channel(channelId),
        );
    }
    createMessage(channelId, data) {
        return this.queueRequest(
            "POST",
            Router.channelMessages(":id"),
            Router.channelMessages(channelId),
            data,
        );
    }
    editMessage(channelId, messageId, data) {
        return this.queueRequest(
            "PATCH",
            Router.channelMessage(":id", ":id"),
            Router.channelMessage(channelId, messageId),
            data,
        );
    }
    deleteMessage(channelId, messageId) {
        return this.queueRequest(
            "DELETE",
            Router.channelMessage(":id", ":id"),
            Router.channelMessage(channelId, messageId),
        );
    }
    triggerTyping(channelId) {
        return this.queueRequest(
            "POST",
            Router.channelTyping(":id"),
            Router.channelTyping(channelId),
        );
    }
    createReaction(channelId, messageId, emoji) {
        return this.queueRequest(
            "PUT",
            Router.channelMessageReactionUser(":id", ":id", ":emoji", "@me"),
            Router.channelMessageReactionUser(
                channelId,
                messageId,
                encodeURIComponent(emoji),
                "@me",
            ),
        );
    }

    createInteractionResponse(interactionId, interactionToken, data) {
        return this.queueRequest(
            "POST",
            Router.interactionCallback(":id", ":token"),
            Router.interactionCallback(interactionId, interactionToken),
            data,
        );
    }
    editOriginalInteractionResponse(applicationId, interactionToken, data) {
        return this.queueRequest(
            "PATCH",
            Router.webhookMessage(":id", ":token"),
            Router.webhookMessage(applicationId, interactionToken),
            data,
        );
    }
    deleteOriginalInteractionResponse(applicationId, interactionToken) {
        return this.queueRequest(
            "DELETE",
            Router.webhookMessage(":id", ":token"),
            Router.webhookMessage(applicationId, interactionToken),
        );
    }

    getApplicationCommands(applicationId, withLocalizations = false) {
        const query = new URLSearchParams({
            with_localizations: withLocalizations,
        });
        const route = Router.applicationCommands(applicationId);
        return this.queueRequest("GET", route, `${route}?${query}`);
    }

    createApplicationCommand(applicationId, commandData) {
        const route = Router.applicationCommands(applicationId);
        return this.queueRequest("POST", route, route, commandData);
    }

    getApplicationCommand(applicationId, commandId) {
        const route = Router.applicationCommand(applicationId, commandId);
        return this.queueRequest("GET", route, route);
    }

    editApplicationCommand(applicationId, commandId, commandData) {
        const route = Router.applicationCommand(applicationId, commandId);
        return this.queueRequest("PATCH", route, route, commandData);
    }

    deleteApplicationCommand(applicationId, commandId) {
        const route = Router.applicationCommand(applicationId, commandId);
        return this.queueRequest("DELETE", route, route);
    }

    bulkOverwriteApplicationCommands(applicationId, commandsData) {
        const route = Router.applicationCommands(applicationId);

        return this.queueRequest("PUT", route, route, commandsData);
    }

    getApplicationGuildCommands(
        applicationId,
        guildId,
        withLocalizations = false,
    ) {
        const query = new URLSearchParams({
            with_localizations: withLocalizations,
        });
        const route = Router.applicationGuildCommands(applicationId, guildId);
        return this.queueRequest("GET", route, `${route}?${query}`);
    }

    createApplicationGuildCommand(applicationId, guildId, commandData) {
        const route = Router.applicationGuildCommands(applicationId, guildId);
        return this.queueRequest("POST", route, route, commandData);
    }

    getApplicationGuildCommand(applicationId, guildId, commandId) {
        const route = Router.applicationGuildCommand(
            applicationId,
            guildId,
            commandId,
        );
        return this.queueRequest("GET", route, route);
    }

    editApplicationGuildCommand(
        applicationId,
        guildId,
        commandId,
        commandData,
    ) {
        const route = Router.applicationGuildCommand(
            applicationId,
            guildId,
            commandId,
        );
        return this.queueRequest("PATCH", route, route, commandData);
    }

    deleteApplicationGuildCommand(applicationId, guildId, commandId) {
        const route = Router.applicationGuildCommand(
            applicationId,
            guildId,
            commandId,
        );
        return this.queueRequest("DELETE", route, route);
    }

    bulkOverwriteApplicationGuildCommands(
        applicationId,
        guildId,
        commandsData,
    ) {
        const route = Router.applicationGuildCommands(applicationId, guildId);
        return this.queueRequest("PUT", route, route, commandsData);
    }

    getCurrentApplication() {
        const route = Router.currentApplication();
        return this.queueRequest("GET", route, route);
    }
}

module.exports = RESTManager;
