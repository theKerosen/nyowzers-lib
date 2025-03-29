const { ComponentTypes } = require("../util/Constants");
const ButtonBuilder = require("./ButtonBuilder");

/**
 * Utility for creating action rows (containers for components).
 */
class ActionRowBuilder {
    constructor(data = {}) {
        this.data = {
            type: ComponentTypes.ACTION_ROW,
            components: [],
            ...data,
        };

        this.components =
            data.components?.map((c) => this._createComponentBuilder(c)) ?? [];
    }

    _createComponentBuilder(componentData) {
        switch (componentData.type) {
            case ComponentTypes.BUTTON:
                return new ButtonBuilder(componentData);

            default:
                console.warn(
                    `[ActionRowBuilder] Unknown component type ${componentData.type} encountered.`,
                );
                return componentData;
        }
    }

    addComponents(...components) {
        const componentsToAdd = components
            .flat()
            .map((c) =>
                c instanceof ButtonBuilder
                    ? c
                    : this._createComponentBuilder(c),
            );
        this.components.push(...componentsToAdd);

        return this;
    }

    setComponents(...components) {
        const componentsToAdd = components
            .flat()
            .map((c) =>
                c instanceof ButtonBuilder
                    ? c
                    : this._createComponentBuilder(c),
            );
        this.components = componentsToAdd;

        return this;
    }

    toJSON() {
        if (this.components.length === 0) {
            throw new Error("Action rows must contain at least one component.");
        }

        return {
            type: this.data.type,
            components: this.components.map((c) => (c.toJSON ? c.toJSON() : c)),
        };
    }
}

module.exports = ActionRowBuilder;
