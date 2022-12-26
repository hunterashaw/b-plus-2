import Node from '../src/node.js'
import fs from 'fs'

const error = (...message) =>
    new Error(
        message
            .map(piece => {
                if (typeof piece === 'string') return piece
                return JSON.stringify(piece, null, 4)
            })
            .join('\n')
    )

console.log('Testing Node:')

const node = new Node()

const keys = ['11', '5', '3', '33', '32', '7', '8', '9', '10']
keys.forEach(key => {
    node.put(key, key)
    node.reset()
})

node.put('5', '5')
node.reset()
node.put('10', '10')
node.reset()

fs.writeFileSync('testDump.json', JSON.stringify(node, null, 4))

// Test Node.find

keys.forEach(key => {
    const findResult = node.find(key)
    if (findResult !== key)
        throw error('Node.find must return matching value.', {
            expected: key,
            findResult
        })
    node.reset()
})

// Test Node.findRange

const testRange = (range, previous) => {
    range.forEach(({ key, value }) => {
        if (key !== value)
            throw error('Node.findRange key must return matching value.', {
                key,
                value
            })
        if (!previous) {
            previous = key
            return
        }
        if (key < previous)
            throw error('Node.findRange key must return ascending keys.', {
                key,
                previous
            })
    })
}

const fullRange = node.findRange()
testRange(fullRange)
node.reset()

testRange(node.findRange('3'), '3')
node.reset()

const exclusiveRange = node.findRange('5', '8')
testRange(exclusiveRange, '5')
if (exclusiveRange.some(({ key }) => key >= '8'))
    throw error('Node.findRange must exclude keys >= end.', {
        exclusiveRange
    })
node.reset()

const limit = 4
const limitedRange = node.findRange('2', undefined, limit)
testRange(limitedRange, '2')
if (limitedRange.length > 4)
    throw error('Node.findRange must return range with length <= limit', {
        length: limitedRange,
        range: limitedRange,
        limit
    })
node.reset()

// Test Node.findPrefix

const prefixRange = node.findPrefix('3')
testRange(prefixRange, '3')
if (prefixRange.some(({ key }) => !key.startsWith('3')))
    throw error('Node.findPrefix must only return keys starting with prefix', {
        key
    })
node.reset()

// Test Node.delete

node.delete('8')
node.reset()
const newRange = node.findRange()
if (newRange.some(({ key }) => key === '8'))
    throw error('Node.delete must remove key from data.', {
        rangeAfterDelete: newRange
    })
testRange(newRange)
node.reset()

// Test Node.findFloor

const testFloor = (parameter, expected, returnKey = false) => {
    const result = node.findFloor(parameter, returnKey)
    if (returnKey) {
        if (result.some(piece => piece !== expected))
            throw error(
                'Node.findFloor must return key and value === expected',
                { result, expected }
            )
    } else if (result !== expected)
        throw error('Node.findFloor must return expected', {
            result,
            expected
        })
    node.reset()
}
testFloor('31', '3')
testFloor('31', '3', true)
testFloor('0', '10')
testFloor('0', '10', true)
testFloor('99', '9')
testFloor('81', '7', true)

// Test Node.replaceKey

node.replaceKey('7', '71')
node.reset()
let replacementValue = node.find('71')
if (replacementValue !== '7')
    throw error('Node.replaceKey must replace key but keep old value', {
        oldKey: '7',
        newKey: '71',
        lookupValue: replacementValue
    })
node.reset()
node.replaceKey('71', '7')
node.reset()

// Test Node.replaceValue

node.replaceValue('10', '11')
node.reset()
replacementValue = node.find('10')
if (replacementValue !== '11')
    throw error('Node.replaceValue must replace value but keep old key', {
        oldValue: '10',
        newValue: '11',
        lookupValue: replacementValue
    })
node.reset()
node.replaceValue('11', '10')
node.reset()

// Test Node.split

const leaves = node.split()
leaves.forEach(leaf => {
    const leafNode = new Node(leaf.data)
    const range = leafNode.findRange()
    if (range[0].key !== leaf.floor)
        throw error(
            'Node.split must return floor matching first key within data',
            { data: leaf.data, firstKey: range[0].key, floor: leaf.floor }
        )
    testRange(range)
})
node.reset()

console.log('Passed.')
