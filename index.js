const fs = require('fs')
const IndexStore = require('./index-store')

const pages = new Map()

const index = new IndexStore({
    pageSize: 1024,
    separator: '_',
    readPage: page => {
        if (pages.has(page))
            return {
                data: pages.get(page),
                metadata: pages.get(`${page}-metadata`)
            }
        return {
            data: '',
            metadata: {}
        }
    },
    writePage: (page, data, metadata) => {
        pages.set(page, data)
        pages.set(`${page}-metadata`, metadata)
    },
    deletePage: page => {
        pages.delete(page)
        pages.delete(`${page}-metadata`)
    }
})

async function populate() {
    const clients = ['bob', 'bill', 'jeff']

    for (let i = 0; i < 40; i++) {
        await index.put(
            'notes',
            `${
                clients[Math.floor(Math.random() * clients.length)]
            }/${Math.floor(Math.random() * 10000)}`,
            JSON.stringify({
                i,
                value: Math.floor(Math.random() * 1000000)
            })
        )
    }
}

async function run() {
    await populate()

    const result = []
    for (const [pageKey, value] of pages.entries()) {
        result.push({ key: pageKey, value })
    }
    fs.writeFileSync('pages.json', JSON.stringify(result, null, 4))

    const jeffs = await index.listPrefix('notes', 'jeff/')

    console.log(jeffs.length, jeffs)
}

run()
