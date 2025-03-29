class BitField {
    constructor(bits = 0n) {
        if (typeof bits !== "bigint") {
            console.warn(
                `[BitField Constructor] Received non-BigInt type: ${typeof bits}. Value: ${bits}. Attempting conversion via static resolve.`,
            );

            const resolver = this.constructor.resolve ?? BitField.resolve;
            try {
                this.bitfield = resolver(bits);
                if (typeof this.bitfield !== "bigint") {
                    throw new Error(
                        `BitField resolver failed to return a BigInt. Resolved to: ${this.bitfield}`,
                    );
                }
            } catch (e) {
                console.error(
                    "Error during BitField resolution/conversion inside constructor:",
                    e,
                );
                console.error("Input 'bits' value that caused error:", bits);
                throw new Error(
                    `Failed to initialize BitField with input: ${bits}`,
                );
            }
        } else {
            this.bitfield = bits;
        }
    }

    static resolve(bit) {
        const BFN = BigInt(0);
        if (typeof bit === "bigint") return bit;
        if (typeof bit === "number" && bit >= 0) return BigInt(bit);
        if (Array.isArray(bit)) {
            return bit
                .map((p) => this.resolve(p))
                .reduce((prev, p) => prev | p, BFN);
        }
        if (typeof bit === "string") {
            const cleanBit = bit.replace(/,/g, "");

            if (!isNaN(cleanBit) && !isNaN(parseFloat(cleanBit)))
                return BigInt(cleanBit);

            if (typeof this.Flags?.[bit] !== "undefined")
                return BigInt(this.Flags[bit]);
        }

        throw new RangeError(
            `Invalid bit type or value: Received ${typeof bit} - ${bit}`,
        );
    }
}

BitField.Flags = {};

module.exports = BitField;
