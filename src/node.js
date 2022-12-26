const separator = '\u0000'

/**
 * Utility class for reading & serializing b+ node/leaf page data
 */
class Node {
    /**
     * Create node reader from serialized string
     * @param {string | undefined} serialized
     */
    constructor(serialized = '') {
        this.position = 0
        this.data = serialized
        this.done = false
    }

    /**
     * Reset read position after action
     */
    reset() {
        this.position = 0
        this.done = false
    }

    /**
     * (Internal function) Read until null character
     * @param {boolean} slice Return read value?
     * @returns {string}
     */
    read(slice = true) {
        if (this.done) return undefined
        const start = this.position
        for (let i = start; i < this.data.length; i++) {
            if (this.data[i] === separator) {
                this.position = i + 1
                return slice ? this.data.slice(start, i) : undefined
            }
        }
        this.done = true
        this.position = this.data.length
        return slice ? this.data.slice(start) : undefined
    }

    /**
     * Lookup value for provided key
     * @param {string} key
     * @returns {string}
     */
    find(key) {
        let currentKey = this.read()
        while (!this.done) {
            if (currentKey === key) return this.read()
            if (currentKey < key) {
                this.read(false) // skip value
                currentKey = this.read()
                continue
            }
            return undefined // currentKey > key, not found
        }
        return undefined // end of node, not found
    }

    /**
     * Lookup entries between start (inclusive) and end (exclusive)
     * @param {string} start
     * @param {string} end
     * @param {number} limit result length limit
     * @returns {{key: string, value: string}[]}
     */
    findRange(start = undefined, end = undefined, limit = 10) {
        let result = []
        let currentKey = this.read()
        while (!this.done) {
            if (currentKey >= end || result.length >= limit) break
            else if (start === undefined || currentKey >= start)
                result.push({ key: currentKey, value: this.read() })
            else this.read(false)

            currentKey = this.read()
        }
        return result.length ? result : undefined
    }

    /**
     * @param {string} prefix Key prefix that all results will start with
     * @param {string} after Inclusive range start
     * @param {number} limit Page size limit
     * @returns {{key: string, value: string}[]}
     */
    findPrefix(prefix, after, limit = 10) {
        let result = []
        let currentKey = this.read()
        let started = false
        const start = after ?? prefix
        while (!this.done) {
            if (started) {
                if (result.length >= limit || !currentKey.startsWith(prefix))
                    break
                result.push({ key: currentKey, value: this.read() })
            } else {
                if (currentKey >= start) {
                    result.push({ key: currentKey, value: this.read() })
                    started = true
                } else this.read(false)
            }

            currentKey = this.read()
        }
        return result.length ? result : undefined
    }

    /**
     * Find highest entry less than key
     * @param {string} key Key to search for
     * @param {boolean} returnKey Return [key, value] of matched entry (false = value only)
     * @returns {string | [string, string]}
     */
    findFloor(key, returnKey = false) {
        let currentKey = this.read()
        let currentValue = this.read()
        while (!this.done) {
            const nextKey = this.read()
            const nextValue = this.read()
            if (nextKey > key) break
            currentKey = nextKey
            currentValue = nextValue
        }
        return returnKey ? [currentKey, currentValue] : currentValue
    }

    /**
     * Create or update entry, keys are expected to be unique
     * @param {string} key
     * @param {string} value
     */
    put(key, value) {
        if (!this.data.length) {
            this.data = key + separator + value
            return
        }
        let previous = this.position
        let currentKey = this.read()
        while (!this.done) {
            if (currentKey === key) {
                const prefix = this.data.slice(0, this.position)
                this.read(false) // read old value
                // replace old value
                this.data =
                    prefix +
                    value +
                    (this.done ? '' : separator) +
                    this.data.slice(this.position)
                return
            }
            if (currentKey < key) {
                this.read(false) // skip value
                previous = this.position
                currentKey = this.read()
                continue
            }
            // insert in between >< values
            this.data =
                this.data.slice(0, previous) +
                key +
                separator +
                value +
                separator +
                this.data.slice(previous)

            return
        }
        this.data = this.data + separator + key + separator + value
    }

    /**
     * Replace first occurrence of oldKey with newKey
     * @param {string} oldKey
     * @param {string} newKey
     */
    replaceKey(oldKey, newKey) {
        let previous = this.position
        let currentKey = this.read()

        while (!this.done) {
            if (currentKey === oldKey) {
                this.data =
                    this.data.slice(0, previous) +
                    newKey +
                    separator +
                    this.data.slice(this.position)
                return
            }
            this.read(false)
            previous = this.position
            currentKey = this.read()
        }
    }

    /**
     * Replace first occurrence of oldValue with newValue
     * @param {string} oldValue
     * @param {string} newValue
     */
    replaceValue(oldValue, newValue) {
        let previous
        let currentValue

        while (!this.done) {
            this.read(false)
            previous = this.position
            currentValue = this.read()

            if (currentValue === oldValue) {
                this.data =
                    this.data.slice(0, previous) +
                    newValue +
                    (this.done ? '' : separator) +
                    this.data.slice(this.position)
                break
            }
        }
    }

    /**
     * @param {string} key Key of entry to delete
     * @returns {boolean}
     */
    delete(key) {
        let previous = this.position
        let currentKey = this.read()
        while (!this.done) {
            if (currentKey === key) {
                this.read(false)
                this.data =
                    this.data.slice(0, previous) +
                    this.data.slice(this.position)
                return true
            }
            if (currentKey < key) {
                this.read(false)
                previous = this.position
                currentKey = this.read()
            }
        }
        return false
    }

    /**
     * Split node in half at entry boundary.
     */
    split() {
        const half = Math.floor(this.data.length / 2)
        this.reset()
        let firstFloor = this.read()
        this.read(false)
        while (this.position < half) {
            this.read(false)
            this.read(false)
        }
        const splitPosition = this.position
        return [
            { floor: firstFloor, data: this.data.slice(0, splitPosition - 1) },
            { floor: this.read(), data: this.data.slice(splitPosition) }
        ]
    }
}

export default Node
