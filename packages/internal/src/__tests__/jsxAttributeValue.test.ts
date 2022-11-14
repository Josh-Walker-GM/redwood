// import path from 'path'

import {
  ArrayExpression,
  BinaryExpression,
  BooleanLiteral,
  Identifier,
  JSXAttribute,
  JSXExpressionContainer,
  NumericLiteral,
  ObjectExpression,
  StringLiteral,
  stringLiteral,
  // TemplateLiteral,
  UnaryExpression,
} from '@babel/types'

import { getJsxAttributeValue } from '../jsxAttributeValue'

test('handles null', () => {
  const attributeValue: JSXAttribute['value'] = null
  expect(getJsxAttributeValue(attributeValue)).toBe(true)
})

test('handles BooleanLiteral', () => {
  let attributeValue: BooleanLiteral = {
    type: 'BooleanLiteral',
    value: true,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BooleanLiteral',
    value: false,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)
})

test('handles NumericLiteral', () => {
  let attributeValue: NumericLiteral = {
    type: 'NumericLiteral',
    value: 0,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(0)

  attributeValue = {
    type: 'NumericLiteral',
    value: -3.14159265,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(-3.14159265)
})

test('handles StringLiteral', () => {
  const attributeValue: StringLiteral = stringLiteral('string')
  expect(getJsxAttributeValue(attributeValue)).toBe('string')
})

test('handles JSXExpressionContainer', () => {
  let attributeValue: JSXExpressionContainer = {
    type: 'JSXExpressionContainer',
    expression: null,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'JSXExpressionContainer',
    expression: { type: 'StringLiteral', value: 'string' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe('string')
})

test('handles ArrayExpression', () => {
  let attributeValue: ArrayExpression = {
    type: 'ArrayExpression',
    elements: [],
  }
  expect(getJsxAttributeValue(attributeValue)).toStrictEqual([])

  attributeValue = {
    type: 'ArrayExpression',
    elements: [
      null,
      { type: 'StringLiteral', value: 'string' },
      {
        type: 'ArrayExpression',
        elements: [null, { type: 'StringLiteral', value: 'string' }],
      },
    ],
  }
  expect(getJsxAttributeValue(attributeValue)).toStrictEqual([
    true,
    'string',
    [true, 'string'],
  ])
})

// test('handles TemplateLiteral', () => {
//   //
// })

test('handles ObjectExpression', () => {
  const attributeValue: ObjectExpression = {
    type: 'ObjectExpression',
    properties: [
      {
        type: 'ObjectProperty',
        key: { type: 'StringLiteral', value: 'key' },
        value: { type: 'StringLiteral', value: 'value' },
        computed: null,
        shorthand: null,
      },
      {
        type: 'ObjectProperty',
        key: { type: 'StringLiteral', value: 'key2' },
        value: { type: 'NumericLiteral', value: 2 },
        computed: null,
        shorthand: null,
      },
      {
        type: 'ObjectProperty',
        key: { type: 'StringLiteral', value: undefined },
        value: { type: 'NumericLiteral', value: 2 },
        computed: null,
        shorthand: null,
      },
    ],
  }
  expect(getJsxAttributeValue(attributeValue)).toStrictEqual({
    key: 'value',
    key2: 2,
  })
})

test('handles Identifier', () => {
  let attributeValue: Identifier = { type: 'Identifier', name: 'one' }
  expect(getJsxAttributeValue(attributeValue)).toBe('one')

  attributeValue = { type: 'Identifier', name: '1' }
  expect(getJsxAttributeValue(attributeValue)).toBe('1')

  attributeValue = { type: 'Identifier', name: 'null' }
  expect(getJsxAttributeValue(attributeValue)).toBe('null')
})

test('handles BinaryExpression', () => {
  let attributeValue: BinaryExpression = {
    type: 'BinaryExpression',
    operator: '+',
    left: { type: 'StringLiteral', value: 'ab' },
    right: { type: 'StringLiteral', value: 'cd' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe('abcd')

  attributeValue = {
    type: 'BinaryExpression',
    operator: '+',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: -2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(-1)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '-',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: -2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(3)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '*',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: -2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(-2)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '**',
    left: { type: 'NumericLiteral', value: 2 },
    right: { type: 'NumericLiteral', value: 10 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1024)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '/',
    left: { type: 'NumericLiteral', value: 2 },
    right: { type: 'NumericLiteral', value: 4 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1 / 2)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '%',
    left: { type: 'NumericLiteral', value: 10 },
    right: { type: 'NumericLiteral', value: 3 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '==',
    left: { type: 'StringLiteral', value: '1' },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '==',
    left: { type: 'StringLiteral', value: '1' },
    right: { type: 'NumericLiteral', value: 0 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '===',
    left: { type: 'StringLiteral', value: 'ab' },
    right: { type: 'StringLiteral', value: 'ab' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '===',
    left: { type: 'StringLiteral', value: 'ab' },
    right: { type: 'StringLiteral', value: 'cd' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '!=',
    left: { type: 'StringLiteral', value: '1' },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '!=',
    left: { type: 'StringLiteral', value: '1' },
    right: { type: 'NumericLiteral', value: 0 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '!==',
    left: { type: 'StringLiteral', value: 'ab' },
    right: { type: 'StringLiteral', value: 'ab' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '!==',
    left: { type: 'StringLiteral', value: 'ab' },
    right: { type: 'StringLiteral', value: 'cd' },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '<',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '<=',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '<=',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(false)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>=',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>=',
    left: { type: 'NumericLiteral', value: 2 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(true)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '<<',
    left: { type: 'NumericLiteral', value: 4 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(8)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>>',
    left: { type: 'NumericLiteral', value: 4 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(2)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>>>',
    left: { type: 'NumericLiteral', value: 5 },
    right: { type: 'NumericLiteral', value: 2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '>>>',
    left: { type: 'NumericLiteral', value: -5 },
    right: { type: 'NumericLiteral', value: 2 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1073741822)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '|',
    left: { type: 'NumericLiteral', value: 12 },
    right: { type: 'NumericLiteral', value: 25 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(29)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '&',
    left: { type: 'NumericLiteral', value: 12 },
    right: { type: 'NumericLiteral', value: 25 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(8)

  attributeValue = {
    type: 'BinaryExpression',
    operator: '^',
    left: { type: 'NumericLiteral', value: 12 },
    right: { type: 'NumericLiteral', value: 25 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(21)

  attributeValue = {
    type: 'BinaryExpression',
    operator: 'instanceof',
    left: { type: 'NumericLiteral', value: 1 },
    right: { type: 'NumericLiteral', value: 1 },
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(
    'BinaryExpression with "instanceof" is not supported'
  )
})

test('handles UnaryExpression', () => {
  // TODO: Question: Why was BooleanLiteral originally not supported?
  let attributeValue: UnaryExpression = {
    type: 'UnaryExpression',
    argument: { type: 'BooleanLiteral', value: true },
    operator: '+',
    prefix: true,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(1)

  attributeValue = {
    type: 'UnaryExpression',
    argument: { type: 'BooleanLiteral', value: true },
    operator: '-',
    prefix: true,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(-1)

  attributeValue = {
    type: 'UnaryExpression',
    argument: { type: 'BooleanLiteral', value: false },
    operator: '~',
    prefix: true,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(-1)

  // TODO: Use these if the new BooleanLiteral and NumericLiteral are reverted
  // let attributeValue: UnaryExpression = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: '1' },
  //   operator: '+',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(1)

  // attributeValue = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: 'test' },
  //   operator: '+',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(NaN)

  // attributeValue = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: '1' },
  //   operator: '-',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(-1)

  // attributeValue = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: 'test' },
  //   operator: '-',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(NaN)

  // attributeValue = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: '' },
  //   operator: '~',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(-1)

  // attributeValue = {
  //   type: 'UnaryExpression',
  //   argument: { type: 'StringLiteral', value: '-1' },
  //   operator: '~',
  //   prefix: true,
  // }
  // expect(getJsxAttributeValue(attributeValue)).toBe(0)

  attributeValue = {
    type: 'UnaryExpression',
    argument: { type: 'BooleanLiteral', value: true },
    operator: '!',
    prefix: true,
  }
  expect(getJsxAttributeValue(attributeValue)).toBe(
    'UnaryExpression with "!" is not supported'
  )
})

//

test('handles unsupported', () => {
  let attributeValue: any = 'unsupported'
  expect(getJsxAttributeValue(attributeValue)).toBe(
    'undefined is not supported'
  )
  attributeValue = { some: 'thing', type: 'testing' }
  expect(getJsxAttributeValue(attributeValue)).toBe('testing is not supported')
})
