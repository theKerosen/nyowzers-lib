const Channel = require("./Channel");
const Collection = require("../util/Collection");

class CategoryChannel extends Channel {
    constructor(client, data, guild = null) {
        super(client, data, guild);
    }

    /**
     * The channels that are children of this category.
     * @type {Collection<string, GuildChannel>}
     * @readonly
     */
    get children() {
        return this.client.channels.cache.filter((c) => c.parentId === this.id);
    }
}

module.exports = CategoryChannel;
