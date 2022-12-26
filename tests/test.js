import Node from '../src/node.js'

const node = new Node()

// start "08\u00001\u000040\u000010"

// finish "08\u00001\u000040\u000011\u0000\u000075\u000012"

node.put('08', '1')
node.reset()
node.put('40', '10')
node.reset()

console.log('start', JSON.stringify(node.data))

node.put('40', '11')
node.reset()
node.put('75', '12')
node.reset()

console.log('end', JSON.stringify(node.data))
