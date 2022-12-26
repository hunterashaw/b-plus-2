import Node from './node.js'

class Store {
    constructor(config) {
        Object.assign(this, { separator: '-' })
        Object.assign(this, config)
    }

    async traverseBranches(keyPrefix, key, returnStack = false) {
        const stack = []
        let current
        const pushPage = async pageKey => {
            let page = await this.readPage(pageKey)
            if (!page) page = { data: '', metadata: { type: 'leaf' } }
            page.key = pageKey
            current = page
            if (returnStack) stack.push(current)
        }
        await pushPage(keyPrefix)

        while (current.metadata.type === 'branch') {
            const node = new Node(current.data)

            if (returnStack) {
                const [matchKey, matchValue] = node.findFloor(key, true)

                if (key < matchKey) {
                    // replace old floor key
                    const previousPage = stack.pop()
                    const previousNode = new Node(previousPage.data)
                    previousNode.replaceKey(matchKey, key)
                    stack.push({
                        data: previousNode.data,
                        key: previousPage.key,
                        metadata: previousPage.metadata
                    })
                }

                await pushPage(`${keyPrefix}${this.separator}${matchValue}`)
            } else
                await pushPage(
                    `${keyPrefix}${this.separator}${node.findFloor(key)}`
                )
        }

        return returnStack ? stack : current
    }

    async put(keyPrefix, key, value) {
        const pages = await this.traverseBranches(keyPrefix, key, true)

        const { key: leafKey, data, metadata } = pages.pop()
        const leaf = new Node(data)
        leaf.put(key, value)

        pages.push({ key: leafKey, data: leaf.data, metadata })
        await this.splitAndWrite(keyPrefix, pages)
    }

    async delete(keyPrefix, key) {
        const { key: leafKey, data } = await this.traverseBranches(
            keyPrefix,
            key
        )
        const leaf = new Node(data)
        leaf.delete(key)
        await this.writePage(leafKey, leaf.data, { type: 'leaf' })
    }

    async list(keyPrefix, after, before) {
        const { data } = await this.traverseBranches(keyPrefix, after)
        const leaf = new Node(data)
        return leaf.findRange(after, before)
    }

    async listPrefix(keyPrefix, prefix, after) {
        const { data } = await this.traverseBranches(keyPrefix, after ?? prefix)
        const leaf = new Node(data)
        return leaf.findPrefix(prefix, after)
    }

    async splitAndWrite(keyPrefix, pages) {
        let current = pages.pop()
        let oldKey
        let newKey
        const oldKeys = []
        const addOldKey = () => {
            oldKey = current.key
            oldKeys.push(oldKey)
        }
        const deleteOldKeys = () =>
            Promise.all(oldKeys.map(key => this.deletePage(key)))

        while (current) {
            // If current page exceeds size limit, split and add pointers to new nodes to parent branch (or root)
            if (current.data.length > this.pageSize) {
                // Cleanup old leaves (besides root)
                if (current.key !== keyPrefix) addOldKey()
                const node = new Node(current.data)
                // Split node into two, write new pages then return floors and pointers

                const leaves = await Promise.all(
                    node.split().map(async ({ data, floor }) => {
                        const key = await this.getNewKey()
                        await this.writePage(
                            `${keyPrefix}${this.separator}${key}`,
                            data,
                            current.metadata
                        )
                        return {
                            key,
                            floor
                        }
                    })
                )

                current = pages.pop()
                if (current) {
                    // parent branch is amended to include new leaves
                    const branch = new Node(current.data)
                    leaves.forEach(({ key, floor }) => {
                        branch.put(floor, key)
                        branch.reset()
                    })
                    current.data = branch.data
                } else {
                    // we split root, so we turn it into a branch
                    const root = new Node('')
                    leaves.forEach(({ key, floor }) => {
                        root.put(floor, key)
                        root.reset()
                    })
                    await this.writePage(keyPrefix, root.data, {
                        type: 'branch'
                    })
                    await deleteOldKeys()
                    return
                }
            }

            if (newKey) {
                const node = new Node(current.data)
                node.replaceValue(
                    oldKey.slice(keyPrefix.length + this.separator.length),
                    newKey
                )
                current.data = node.data
            }

            if (current.key === keyPrefix) {
                // current === root
                await this.writePage(keyPrefix, current.data, current.metadata)
                await deleteOldKeys()
                return
            } else {
                addOldKey()
                newKey = await this.getNewKey()
                await this.writePage(
                    `${keyPrefix}${this.separator}${newKey}`,
                    current.data,
                    current.metadata
                )
                current = pages.pop()
            }
        }
    }
}

export default Store
