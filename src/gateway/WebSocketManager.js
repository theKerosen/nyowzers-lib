const WebSocket = require("ws");
const EventEmitter = require("events");
const util = require("util");
const {
    GatewayVersion,
    GatewayOpcodes,
    GatewayCloseCodes,
    Events,
} = require("../util/Constants");
const GatewayEventHandler = require("./GatewayEventHandler");
const zlib = require("zlib-sync");

const ZLIB_SUFFIX = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const FLUSH_MODE = zlib.Z_SYNC_FLUSH;

class WebSocketManager extends EventEmitter {
    constructor(client) {
        super();
        this.client = client;
        this.ws = null;
        this.gatewayUrl = null;
        this.heartbeatInterval = null;
        this.heartbeatTimer = null;
        this.sequence = null;
        this.sessionId = null;
        this.resumeGatewayUrl = null;
        this.lastHeartbeatAck = true;
        this.lastHeartbeatSent = null;
        this.latency = Infinity;
        this.status = "idle";
        this.eventHandler = new GatewayEventHandler(this.client, this);
        try {
            this.inflate = new zlib.Inflate({
                chunkSize: 65535,
            });
            console.log("[WS] zlib-sync Inflate context initialized.");
        } catch (e) {
            console.error(
                "[WS FATAL] Failed to initialize zlib-sync Inflate:",
                e,
            );
            this.inflate = null;
        }
    }

    async connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.client.emit("warn", "[WS] Already connected or connecting.");
            return;
        }

        this.status = "connecting";
        this.client.emit("debug", "[WS] Connecting...");

        try {
            const urlToUse =
                this.resumeGatewayUrl || (await this.fetchGatewayUrl());
            if (!urlToUse) {
                throw new Error("Failed to get Gateway URL.");
            }
            this.gatewayUrl = `${urlToUse}?v=${GatewayVersion}&encoding=json&compress=zlib-stream`;

            this.ws = new WebSocket(this.gatewayUrl);
            this.ws.on("open", this._onOpen.bind(this));
            this.ws.on("message", this._onMessage.bind(this));
            this.ws.on("close", this._onClose.bind(this));
            this.ws.on("error", this._onError.bind(this));
        } catch (error) {
            this.client.emit(
                "error",
                new Error(`[WS] Connection failed: ${error.message}`),
            );
            this._handleDisconnect();
        }
    }

    async fetchGatewayUrl() {
        try {
            const data = await this.client.rest.getGatewayBot();
            return data.url;
        } catch (error) {
            this.client.emit(
                "error",
                new Error(`[WS] Failed to fetch gateway URL: ${error.message}`),
            );
            return null;
        }
    }

    _onOpen() {
        this.client.emit(
            "debug",
            `[WS] Connection opened to ${this.gatewayUrl}. Waiting for HELLO.`,
        );
        this.status = "handshaking";
    }

    _onMessage(data) {
        let packet = null;
        let rawDataStr = null;

        try {
            if (data instanceof Buffer) {
                if (!this.inflate) {
                    this.client.emit(
                        "warn",
                        "[WS] Received buffer but inflate context is not available.",
                    );
                    return;
                }

                this.inflate.push(data, FLUSH_MODE);

                if (this.inflate.err) {
                    this.client.emit(
                        "warn",
                        `[WS] Decompression error: ${this.inflate.err} (${this.inflate.msg})`,
                    );
                    console.error(
                        "[WS Decompression] Raw data (Buffer):",
                        data,
                    );
                    this.inflate.err = 0;
                    return;
                }

                const decompressed = this.inflate.result;

                if (
                    !decompressed ||
                    !(decompressed instanceof Buffer) ||
                    decompressed.length === 0
                ) {
                    this.client.emit(
                        "warn",
                        `[WS] Decompression result is invalid or empty.`,
                    );
                    console.error(
                        "[WS Decompression] Inflate result:",
                        decompressed,
                    );
                    console.error(
                        "[WS Decompression] Raw data (Buffer):",
                        data,
                    );
                    return;
                }
                rawDataStr = decompressed.toString("utf-8");
            } else if (typeof data === "string") {
                rawDataStr = data;
            } else {
                this.client.emit(
                    "warn",
                    `[WS] Received unexpected data type: ${typeof data}`,
                );
                console.error("[WS Data Type] Data:", data);
                return;
            }

            if (!rawDataStr) {
                this.client.emit(
                    "warn",
                    "[WS] Received empty data string after processing.",
                );
                return;
            }

            packet = JSON.parse(rawDataStr);
        } catch (err) {
            this.client.emit(
                "warn",
                `[WS] Failed to process/parse message: ${err.message}`,
            );

            console.error(
                "[WS Parse Error] Raw data string causing error (first 200 chars):",
                rawDataStr?.slice(0, 200),
            );
            packet = null;
        }

        if (packet === null) {
            return;
        }

        this._handlePacket(packet);
    }

    _handlePacket(packet) {
        if (!packet) {
            this.client.emit(
                "error",
                new Error(
                    "[WS FATAL _handlePacket] Received null packet unexpectedly!",
                ),
            );
            console.error("[WS FATAL _handlePacket] Stack:", new Error().stack);
            return;
        }

        if (packet.s) {
            this.sequence = packet.s;
        }

        switch (packet.op) {
            case GatewayOpcodes.HELLO:
                this.client.emit(
                    "debug",
                    `[WS] Received HELLO. Heartbeat interval: ${packet.d.heartbeat_interval}ms`,
                );
                this.lastHeartbeatAck = true;
                this._startHeartbeat(packet.d.heartbeat_interval);
                this._identify();
                this.status = "identifying";
                break;

            case GatewayOpcodes.HEARTBEAT_ACK:
                this.lastHeartbeatAck = true;
                this.latency = Date.now() - this.lastHeartbeatSent;
                this.client.emit(
                    "debug",
                    `[WS] Received Heartbeat ACK. Latency: ${this.latency}ms`,
                );
                break;

            case GatewayOpcodes.HEARTBEAT:
                this.client.emit(
                    "debug",
                    "[WS] Received Heartbeat request. Sending heartbeat.",
                );
                this._sendHeartbeat(true);
                break;

            case GatewayOpcodes.DISPATCH:
                try {
                    this.eventHandler.handle(packet);
                } catch (error) {
                    this.client.emit(
                        "error",
                        new Error(
                            `[WS] Error during handle of event ${packet.t}: ${error.message}\nPayload: ${util.inspect(packet.d)}`,
                        ),
                    );
                    console.error(`Error handling ${packet.t}:`, error);
                }
                break;

            case GatewayOpcodes.INVALID_SESSION:
                this.client.emit(
                    "warn",
                    `[WS] Received Invalid Session. Resumable: ${packet.d}`,
                );
                this.sessionId = null;
                this.resumeGatewayUrl = null;
                if (packet.d) {
                    setTimeout(
                        () => this._identify(true),
                        Math.random() * 4000 + 1000,
                    );
                } else {
                    this._handleDisconnect(false);
                }
                break;

            case GatewayOpcodes.RECONNECT:
                this.client.emit(
                    "warn",
                    "[WS] Received Reconnect request. Closing and reconnecting.",
                );
                this._handleDisconnect(true);
                break;

            default:
                this.client.emit(
                    "debug",
                    `[WS] Received unknown opcode: ${packet.op}`,
                );
        }
    }

    _identify(forceNew = false) {
        if (!forceNew && this.sessionId && this.resumeGatewayUrl) {
            this._resume();
        } else {
            this.client.emit("debug", "[WS] Sending IDENTIFY payload.");
            const payload = {
                op: GatewayOpcodes.IDENTIFY,
                d: {
                    token: this.client.token,
                    intents: this.client.options.intents.bitfield,
                    properties: {
                        $os: process.platform,
                        $browser: "my-discord-lib",
                        $device: "my-discord-lib",
                    },

                    compress: true,
                },
            };
            this._send(payload);
            this.status = "identifying";
        }
    }

    _resume() {
        this.client.emit(
            "debug",
            `[WS] Attempting to RESUME session ${this.sessionId} sequence ${this.sequence}`,
        );
        const payload = {
            op: GatewayOpcodes.RESUME,
            d: {
                token: this.client.token,
                session_id: this.sessionId,
                seq: this.sequence,
            },
        };
        this._send(payload);
        this.status = "resuming";
    }

    _startHeartbeat(interval) {
        this.heartbeatInterval = interval;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        setTimeout(() => {
            this._sendHeartbeat();
            this.heartbeatTimer = setInterval(
                () => this._sendHeartbeat(),
                this.heartbeatInterval,
            );
        }, this.heartbeatInterval * Math.random());
    }

    _sendHeartbeat(ignoreAck = false) {
        if (!ignoreAck && !this.lastHeartbeatAck) {
            this.client.emit(
                "warn",
                "[WS] Heartbeat ACK missing. Closing connection.",
            );

            this._handleDisconnect(true, 4009);
            return;
        }

        this.client.emit("debug", "[WS] Sending Heartbeat.");
        this.lastHeartbeatAck = false;
        this.lastHeartbeatSent = Date.now();
        this._send({ op: GatewayOpcodes.HEARTBEAT, d: this.sequence });
    }

    _send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const stringifiedData = JSON.stringify(data, (key, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                );
                this.ws.send(stringifiedData, (err) => {
                    if (err)
                        this.client.emit(
                            "error",
                            new Error(
                                `[WS] Failed to send payload (ws.send callback): ${err.message}`,
                            ),
                        );
                });
            } catch (stringifyError) {
                console.error(
                    "[FATAL] JSON.stringify failed inside WebSocketManager._send:",
                    stringifyError.message,
                );
                console.error(
                    "Data that failed:",
                    util.inspect(data, { depth: 5 }),
                );
                this.client.emit(
                    "error",
                    new Error(
                        `Failed to stringify WebSocket payload: ${stringifyError.message}`,
                    ),
                );
            }
        } else {
            this.client.emit(
                "warn",
                "[WS] Attempted to send payload while WebSocket not open.",
            );
        }
    }

    _onClose(code, reason) {
        this.client.emit(
            "debug",
            `[WS] Connection closed. Code: ${code}, Reason: ${reason?.toString()}`,
        );
        this._cleanup();

        const resumable =
            code !== 1000 &&
            code !== 1001 &&
            !GatewayCloseCodes[code]?.startsWith("INVALID");
        this._handleDisconnect(resumable, code);
    }

    _onError(error) {
        this.client.emit(
            "error",
            new Error(`[WS] WebSocket error: ${error.message}`),
        );

        if (this.status !== "reconnecting") {
            this._handleDisconnect(true);
        }
    }

    _cleanup() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();

            if (this.ws.readyState !== WebSocket.CLOSED) {
                try {
                    this.ws.close(1000);
                } catch (e) {
                    /* ignore */
                }
            }
            this.ws = null;
        }
        this.latency = Infinity;
        this.lastHeartbeatAck = true;
    }

    _handleDisconnect(resumable = true, code) {
        this._cleanup();
        this.status = "disconnected";
        this.client.emit(Events.WS_CLOSED, code);

        if (!resumable) {
            this.client.emit(
                "debug",
                "[WS] Session is not resumable. Resetting session state.",
            );
            this.sessionId = null;
            this.sequence = null;
            this.resumeGatewayUrl = null;
        } else {
            this.client.emit("debug", "[WS] Session may be resumable.");
        }

        this.status = "reconnecting";
        this.client.emit(Events.RECONNECTING);
        const reconnectDelay = this.client.options.reconnectDelay || 5000;
        this.client.emit(
            "debug",
            `[WS] Attempting to reconnect in ${reconnectDelay}ms...`,
        );
        setTimeout(() => {
            this.connect();
        }, reconnectDelay);
    }

    disconnect(resume = true) {
        if (this.ws) {
            this.client.emit("debug", `[WS] Disconnecting. Resume: ${resume}`);
            this.ws.close(resume ? 4000 : 1000);
            this._cleanup();
            this.status = "disconnected";
            if (!resume) {
                this.sessionId = null;
                this.sequence = null;
                this.resumeGatewayUrl = null;
            }
        }
    }
}

module.exports = WebSocketManager;
