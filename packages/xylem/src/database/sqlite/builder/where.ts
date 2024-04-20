import type {
  AmbitionComparisonNode,
  AmbitionLogicalNode,
} from '../../../ambition'
import {
  AmbitionComparisonOperator,
  type AmbitionEntryRead,
} from '../../../ambition'
import type { PreparedStatementData } from '../../database'
import { isSafeSqlName } from '../../utilities'

import { generateUniqueVariablePlaceholder } from './util'

export function handleNode(
  data: PreparedStatementData,
  node: AmbitionEntryRead['where'],
) {
  if (node === null) {
    return
  }
  data.sql.push('WHERE')
  data.sql.push('(')

  switch (node.type) {
    case 'AmbitionLogicalNode':
      handleAmbitionLogicalNode(data, node as AmbitionLogicalNode)
      break
    case 'AmbitionComparisonNode':
      handleAmbitionComparisonNode(data, node as AmbitionComparisonNode)
      break
    default:
      throw new Error('Unknown AmbitionNode type')
  }

  data.sql.push(')')
}

function handleAmbitionLogicalNode(
  _data: PreparedStatementData,
  _node: AmbitionLogicalNode,
) {
  //
}

function handleAmbitionComparisonNode(
  { sql, values }: PreparedStatementData,
  node: AmbitionComparisonNode,
) {
  if (!isSafeSqlName(node.column)) {
    throw new Error(`Invalid column name: ${node.column}`)
  }
  sql.push(node.column)
  switch (node.operator) {
    case AmbitionComparisonOperator.EQUAL:
      sql.push('=')
      break
    case AmbitionComparisonOperator.NOT_EQUAL:
      sql.push('<>')
      break
    case AmbitionComparisonOperator.LESS_THAN:
      sql.push('<')
      break
    case AmbitionComparisonOperator.LESS_THAN_OR_EQUAL:
      sql.push('<=')
      break
    case AmbitionComparisonOperator.GREATER_THAN:
      sql.push('>')
      break
    case AmbitionComparisonOperator.GREATER_THAN_OR_EQUAL:
      sql.push('>=')
      break
    default:
      throw new Error('Unknown AmbitionComparisonOperator')
  }
  const vName = generateUniqueVariablePlaceholder(values)
  sql.push(vName)
  values[vName] = node.value
}
