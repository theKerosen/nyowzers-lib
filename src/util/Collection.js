class Collection extends Map {
    constructor(iterable) {
        super(iterable);
    }

    first() {
        return this.values().next().value;
    }

    firstKey() {
        return this.keys().next().value;
    }

    last() {
        const arr = [...this.values()];
        return arr[arr.length - 1];
    }

    lastKey() {
        const arr = [...this.keys()];
        return arr[arr.length - 1];
    }

    find(fn) {
        for (const item of this.values()) {
            if (fn(item)) {
                return item;
            }
        }
        return undefined;
    }

    filter(fn) {
        const results = new Collection();
        for (const [key, item] of this.entries()) {
            if (fn(item)) {
                results.set(key, item);
            }
        }
        return results;
    }

    map(fn) {
        const arr = [];
        for (const item of this.values()) {
            arr.push(fn(item));
        }
        return arr;
    }

    some(fn) {
        for (const item of this.values()) {
            if (fn(item)) {
                return true;
            }
        }
        return false;
    }

    every(fn) {
        for (const item of this.values()) {
            if (!fn(item)) {
                return false;
            }
        }
        return true;
    }

    reduce(fn, initialValue) {
        let accumulator = initialValue;
        let first = true;
        if (initialValue === undefined && this.size > 0) {
            accumulator = this.first();
            first = false;
        }

        let index = 0;
        for (const value of this.values()) {
            if (first && index === 0) {
                index++;
                continue;
            }
            accumulator = fn(accumulator, value, index++, this);
        }
        return accumulator;
    }

    toArray() {
        return [...this.values()];
    }

    keyArray() {
        return [...this.keys()];
    }

    random() {
        const arr = this.toArray();
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

module.exports = Collection;
