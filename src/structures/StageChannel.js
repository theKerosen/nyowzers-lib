const VoiceChannel = require("./VoiceChannel");

class StageChannel extends VoiceChannel {
    constructor(client, data, guild = null) {
        super(client, data, guild);

        this._patchStage(data);
    }

    _patchStage(data) {
        if ("topic" in data) this.topic = data.topic;
    }

    _patch(data) {
        super._patch(data);
        this._patchStage(data);
        return this;
    }

    async createStageInstance(options) {
        throw new Error("Stage instance management not implemented.");
    }
    async getStageInstance() {
        throw new Error("Stage instance management not implemented.");
    }
    async editStageInstance(options) {
        throw new Error("Stage instance management not implemented.");
    }
    async deleteStageInstance() {
        throw new Error("Stage instance management not implemented.");
    }
}

module.exports = StageChannel;
