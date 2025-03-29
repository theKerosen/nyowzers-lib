const EventEmitter = require("events");
const RESTManager = require("./rest/RESTManager");
const WebSocketManager = require("./gateway/WebSocketManager");
const GuildManager = require("./managers/GuildManager");
const ChannelManager = require("./managers/ChannelManager");
const UserManager = require("./managers/UserManager");
const Base = require("./structures/Base");
const ApplicationCommandManager = require("./managers/ApplicationCommandManager");
const Intents = require("./util/Intents");
const { Events, DefaultIntentsBitField } = require("./util/Constants");

const defaultOptions = {
    intents: DefaultIntentsBitField,

    guildCacheLimit: Infinity,
    channelCacheLimit: Infinity,
    userCacheLimit: Infinity,
    memberCacheLimit: 1000,
    messageCacheLimit: 200,

    restRequestTimeout: 15000,
    reconnectDelay: 5000,
};

class ClientApplication extends Base {
    constructor(client, data) {
        super(client);
        this.id = data.id;
        this.name = data.name;

        this._patch(data);
    }
    _patch(data) {
        if ("name" in data) this.name = data.name;
        if ("id" in data) this.id = data.id;

        return this;
    }
}

class Client extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = { ...defaultOptions, ...options };

        if (!this.options.token || typeof this.options.token !== "string") {
            throw new Error(
                "A valid token must be provided in client options.",
            );
        }

        Object.defineProperty(this, "token", { value: this.options.token });
        delete this.options.token;

        this.options.intents = new Intents(this.options.intents);

        this.rest = new RESTManager(this);
        this.ws = new WebSocketManager(this);

        this.guilds = new GuildManager(this);
        this.channels = new ChannelManager(this);
        this.users = new UserManager(this);

        this.application = null;

        this.commands = new ApplicationCommandManager(this);

        this.ready = false;
        this.readyAt = null;
        this.user = null;
        this.startTime = null;

        this._bindWsEvents();
    }

    async _bindWsEvents() {
        this.ws.on(Events.WS_READY, () => {
            this.emit("debug", "[Client] WebSocket connection ready.");
        });

        try {
            if (!this.application) {
                const appData = await this.rest.getCurrentApplication();

                this.application = new ClientApplication(this, appData);
                this.emit(
                    "debug",
                    `[Client] Fetched application info. ID: ${this.application.id}`,
                );
            }
        } catch (error) {
            this.emit(
                "warn",
                `[Client] Failed to fetch application info on ready: ${error.message}`,
            );
        }

        this.ws.on(Events.WS_CLOSED, (code) => {
            this.ready = false;
            this.emit(Events.DISCONNECTED, code);
        });

        this.ws.on(Events.WS_ERROR, (error) => {
            this.emit(Events.ERROR, error);
        });

        if (this.options.debugRawWs) {
            this.ws.on(Events.WS_PACKET, (packet) => {
                this.emit("rawWsPacket", packet);
            });
        }
    }

    get uptime() {
        return this.startTime ? Date.now() - this.startTime : null;
    }

    async login(token = this.token) {
        if (typeof token !== "string")
            throw new Error("Token must be a string.");

        Object.defineProperty(this, "token", { value: token });

        this.startTime = Date.now();
        this.emit("debug", "[Client] Logging in...");

        try {
            await this.ws.fetchGatewayUrl();

            await this.ws.connect();
        } catch (error) {
            this.emit(
                "error",
                new Error(`[Client] Login failed: ${error.message}`),
            );

            this.destroy();
            throw error;
        }

        return token;
    }

    destroy() {
        this.emit("debug", "[Client] Destroying client...");
        this.ws.disconnect(false);

        this.guilds.cache.clear();
        this.channels.cache.clear();
        this.users.cache.clear();

        this.ready = false;
        this.user = null;
        this.startTime = null;
        this.emit("destroyed");
    }
}

module.exports = Client;
