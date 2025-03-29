/**
 * Utility for creating message embeds.
 * Follows the Discord API structure closely.
 */
class EmbedBuilder {
    constructor(data = {}) {
        this.data = { ...data };
        if (data.fields) this.data.fields = data.fields.map((f) => ({ ...f }));
    }

    setTitle(title) {
        this.data.title = title;
        return this;
    }

    setDescription(description) {
        this.data.description = description;
        return this;
    }

    setURL(url) {
        this.data.url = url;
        return this;
    }

    setTimestamp(timestamp = Date.now()) {
        this.data.timestamp = new Date(timestamp).toISOString();
        return this;
    }

    setColor(color) {
        this.data.color = color;
        return this;
    }

    setFooter(options) {
        if (typeof options === "string") {
            this.data.footer = { text: options };
        } else {
            this.data.footer = {
                text: options?.text,
                icon_url: options?.iconURL,
            };
        }
        return this;
    }

    setImage(url) {
        this.data.image = { url };
        return this;
    }

    setThumbnail(url) {
        this.data.thumbnail = { url };
        return this;
    }

    setAuthor(options) {
        if (options === null) {
            delete this.data.author;
            return this;
        }
        this.data.author = {
            name: options.name,
            url: options.url,
            icon_url: options.iconURL,
        };
        return this;
    }

    addField(name, value, inline = false) {
        if (!this.data.fields) {
            this.data.fields = [];
        }

        this.data.fields.push({ name, value, inline });
        return this;
    }

    addFields(...fields) {
        if (!this.data.fields) {
            this.data.fields = [];
        }

        const fieldsToAdd = fields.flat().map((field) => ({
            name: field.name,
            value: field.value,
            inline: field.inline ?? false,
        }));
        this.data.fields.push(...fieldsToAdd);

        return this;
    }

    spliceFields(index, deleteCount, ...fields) {
        if (!this.data.fields) this.data.fields = [];
        const fieldsToAdd = fields.flat().map((field) => ({
            name: field.name,
            value: field.value,
            inline: field.inline ?? false,
        }));
        this.data.fields.splice(index, deleteCount, ...fieldsToAdd);
        return this;
    }

    setFields(...fields) {
        const fieldsToAdd = fields.flat().map((field) => ({
            name: field.name,
            value: field.value,
            inline: field.inline ?? false,
        }));
        this.data.fields = fieldsToAdd;
        return this;
    }

    toJSON() {
        return { ...this.data };
    }
}

module.exports = EmbedBuilder;
