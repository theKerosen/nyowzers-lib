const EventEmitter = require("events");
const Collection = require("../util/Collection");

class BaseCollector extends EventEmitter {
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.options = options;
        this.filter = options.filter ?? (() => true);
        this.collected = new Collection();
        this.ended = false;
        this.timeout = null;
        this.idleTimer = null;
        this._listener = this._handleCollect.bind(this);

        this.options.time = Number(options.time) || Infinity;
        this.options.idle = Number(options.idle) || Infinity;
        this.options.max = Number(options.max) || Infinity;
        this.options.maxProcessed = Number(options.maxProcessed) || Infinity;

        this.listenerAttached = false;
    }

    _handleCollect(...args) {
        const item = this.collect(...args);
        if (item && this.filter(item, this.collected)) {
            this.collected.set(item.id ?? item, item);
            this.emit("collect", item);

            if (this.options.idle !== Infinity) {
                clearTimeout(this.idleTimer);
                this.idleTimer = setTimeout(
                    () => this.stop("idle"),
                    this.options.idle,
                );
            }

            if (this.collected.size >= this.options.max) {
                this.stop("limit");
            }
        }

        this.checkEnd();
    }

    collect(..._args) {
        return null;
    }

    stop(reason = "user") {
        if (this.ended) return;

        this.ended = true;

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        this._cleanup();

        this.emit("end", this.collected, reason);
    }

    resetTimer({ time, idle } = {}) {
        if (this.timeout) clearTimeout(this.timeout);
        if (idle ?? this.options.idle !== Infinity) {
            if (this.idleTimer) clearTimeout(this.idleTimer);
            this.idleTimer = setTimeout(
                () => this.stop("idle"),
                idle ?? this.options.idle,
            );
        }
        this.timeout = setTimeout(
            () => this.stop("time"),
            time ?? this.options.time,
        );
    }

    checkEnd() {
        return this.ended;
    }

    _start() {
        if (this.options.time !== Infinity) {
            this.timeout = setTimeout(
                () => this.stop("time"),
                this.options.time,
            );
        }
        if (this.options.idle !== Infinity) {
            this.idleTimer = setTimeout(
                () => this.stop("idle"),
                this.options.idle,
            );
        }
    }

    _cleanup() {
        this.listenerAttached = false;
    }

    async next() {
        return new Promise((resolve, reject) => {
            if (this.ended) {
                reject(new Error("Collector ended"));
                return;
            }
            const cleanup = () => {
                this.off("collect", onCollect);
                this.off("end", onEnd);
            };
            const onCollect = (item) => {
                cleanup();
                resolve(item);
            };
            const onEnd = (_collected, reason) => {
                cleanup();
                reject(new Error(`Collector ended: ${reason}`));
            };
            this.once("collect", onCollect);
            this.once("end", onEnd);
        });
    }
}

module.exports = BaseCollector;
