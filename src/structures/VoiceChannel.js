const Channel = require("./Channel");
const Collection = require("../util/Collection");

class VoiceChannel extends Channel {
    constructor(client, data, guild = null) {
        super(client, data, guild);
        this._patch(data);
    }

    _patch(data) {
        super._patch(data);
        if ("bitrate" in data) this.bitrate = data.bitrate;
        if ("user_limit" in data) this.userLimit = data.user_limit ?? 0;
        if ("rtc_region" in data) this.rtcRegion = data.rtc_region;
        if ("video_quality_mode" in data)
            this.videoQualityMode = data.video_quality_mode;

        if ("status" in data) this.status = data.status;
        return this;
    }

    /**
     * Checks if the client has permission to join this voice channel.
     * @type {boolean}
     * @readonly
     */
    get joinable() {
        if (!this.guild?.members?.me) return false;

        return true;
    }

    /**
     * Checks if the client has permission to speak in this voice channel.
     * @type {boolean}
     * @readonly
     */
    get speakable() {
        if (!this.guild?.members?.me) return false;

        return true;
    }

    /**
     * Joins this voice channel. (Not Implemented)
     * @returns {Promise<void>}
     */
    async join() {
        throw new Error("Voice connection not implemented.");
    }

    /**
     * Leaves this voice channel if connected. (Not Implemented)
     */
    leave() {
        throw new Error("Voice connection not implemented.");
    }

    /**
     * The members currently connected to this voice channel.
     * @type {Collection<string, Member>}
     * @readonly
     */
    get members() {
        if (!this.guild) return new Collection();

        return new Collection();
    }
}

module.exports = VoiceChannel;
