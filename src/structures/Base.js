class Base {
    constructor(client) {
        this.client = client;
    }

    _clone() {
        return Object.assign(Object.create(this), this);
    }

    _patch(data) {
        for (const key in data) {
            if (
                data.hasOwnProperty(key) &&
                key !== "client" &&
                typeof this[key] !== "function"
            ) {
                this[key] = data[key];
            }
        }
        return this;
    }

    toJSON(...props) {
        const json = {};
        const ignoredProps = ["client"];
        for (const prop in this) {
            if (
                this.hasOwnProperty(prop) &&
                !ignoredProps.includes(prop) &&
                typeof this[prop] !== "function"
            ) {
                const value = this[prop];
                if (value?.toJSON) {
                    json[prop] = value.toJSON();
                } else if (
                    value instanceof Map ||
                    value?.constructor?.name === "Collection"
                ) {
                    json[prop] = Array.from(value.entries());
                } else {
                    json[prop] = value;
                }
            }
        }
        return json;
    }
}

module.exports = Base;
