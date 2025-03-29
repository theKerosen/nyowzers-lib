const Interaction = require("./Interaction");
const { ComponentTypes } = require("../util/Constants");

class ButtonInteraction extends Interaction {
    constructor(client, data) {
        super(client, data);

        this.customId = this.componentData?.custom_id;
        this.componentType = this.componentData?.component_type;
    }
}

module.exports = ButtonInteraction;
