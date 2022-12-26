import Store from '../src/store.js'
import webcrypto from 'node:crypto'
import fs from 'fs'

console.log('Testing Store')

const pages = {}
let currentPage = 1
const store = new Store({
    pageSize: 100,
    getNewKey: () => (currentPage++).toString(),
    readPage: page => {
        return pages[page]
    },
    writePage: (page, data, metadata) => {
        pages[page] = { data, metadata }
    },
    deletePage: page => {
        delete pages[page]
    }
})

async function run() {
    const index = 'test'

    for (let i = 0; i < 1000; i++) {
        let key = Math.floor(Math.random() * 1000).toString()
        if (key.length === 1) key = '0' + key
        else if (key.length === 2) key = '00' + key
        await store.put(index, key, key)
    }

    fs.writeFileSync('dump.json', JSON.stringify(pages, null, 4))
}

run()
