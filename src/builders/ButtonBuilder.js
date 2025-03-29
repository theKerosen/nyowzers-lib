const { ComponentTypes, ButtonStyle } = require("../util/Constants");

/**
 * Utility for creating message buttons.
 * See: https:
 */
class ButtonBuilder {
    constructor(data = {}) {
        this.data = { type: ComponentTypes.BUTTON, ...data };
    }

    setStyle(style) {
        this.data.style =
            typeof style === "string"
                ? ButtonStyle[style.toUpperCase()]
                : style;
        return this;
    }

    setLabel(label) {
        this.data.label = label;
        return this;
    }

    setEmoji(emoji) {
        if (!emoji) {
            delete this.data.emoji;
            return this;
        }

        if (typeof emoji === "string") {
            const match = emoji.match(/^(?:<a?:(\w+):)?(\d+)>$/);
            if (match) {
                this.data.emoji = {
                    id: match[2],
                    name: match[1] ?? null,
                    animated: emoji.startsWith("<a:"),
                };
            } else {
                this.data.emoji = { id: null, name: emoji, animated: false };
            }
        } else {
            this.data.emoji = {
                id: emoji.id,
                name: emoji.name,
                animated: emoji.animated ?? false,
            };
        }
        return this;
    }

    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }

    setURL(url) {
        this.data.url = url;
        return this;
    }

    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }

    toJSON() {
        if (this.data.style === ButtonStyle.LINK && !this.data.url) {
            throw new Error("Link buttons must have a URL.");
        }
        if (this.data.style !== ButtonStyle.LINK && !this.data.custom_id) {
            throw new Error("Non-link buttons must have a custom_id.");
        }

        if (!this.data.label && !this.data.emoji) {
            throw new Error("Buttons must have a label or an emoji.");
        }

        return { ...this.data };
    }
}

module.exports = ButtonBuilder;
