const Base = require("./Base");

class User extends Base {
    constructor(client, data) {
        super(client);
        this.id = data.id;
        this._patch(data);
    }

    _patch(data) {
        if ("username" in data) this.username = data.username;
        if ("discriminator" in data) this.discriminator = data.discriminator;
        if ("avatar" in data) this.avatar = data.avatar;
        if ("bot" in data) this.bot = Boolean(data.bot);
        if ("system" in data) this.system = Boolean(data.system);

        if ("public_flags" in data) this.flags = data.public_flags;

        return this;
    }

    get tag() {
        return typeof this.username === "string"
            ? `${this.username}#${this.discriminator}`
            : null;
    }

    avatarURL({ dynamic = true, size = 1024, format = "webp" } = {}) {
        if (!this.avatar) {
            const defaultAvatarIndex = parseInt(this.discriminator) % 5;
            return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
        }
        let formatStr = format.toLowerCase();
        if (dynamic && this.avatar.startsWith("a_")) {
            formatStr = "gif";
        }
        return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.${formatStr}?size=${size}`;
    }

    toString() {
        return `<@${this.id}>`;
    }
}

module.exports = User;
