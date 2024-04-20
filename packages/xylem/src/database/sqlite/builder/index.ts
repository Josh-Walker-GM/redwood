import { AmbitionEntryRead } from '../../../ambition'
import type { AmbitionEntry } from '../../../ambition'
import type { PreparedStatementData } from '../../database'
import { isSafeSqlName } from '../../utilities'

import { handleNode as handleWhereNode } from './where'

export function buildStatement(entry: AmbitionEntry): PreparedStatementData {
  const data: PreparedStatementData = {
    sql: [],
    values: {},
  }
  if (entry instanceof AmbitionEntryRead) {
    buildReadStatement(data, entry)
  } else {
    throw new Error('Unkown entry type')
  }

  return data
}

function buildReadStatement(
  { sql, values }: PreparedStatementData,
  entry: AmbitionEntryRead,
) {
  sql.push('SELECT')

  // Handle columns
  if (entry.columns.length === 0) {
    sql.push('*')
  } else {
    for (let i = 0; i < entry.columns.length; i++) {
      if (!isSafeSqlName(entry.columns[i])) {
        throw new Error(`Invalid column name: ${entry.columns[i]}`)
      }

      sql.push(entry.columns[i])
      if (i < entry.columns.length - 1) {
        sql.push(',')
      }
    }
  }

  // Handle from
  if (!isSafeSqlName(entry.from)) {
    throw new Error(`Invalid table name: ${entry.from}`)
  }
  sql.push(`FROM ${entry.from}`)

  // Handle where
  if (entry.where !== null) {
    handleWhereNode({ sql, values }, entry.where)
  }

  // Handle groups
  // Handle having
  // Handle order
  // Handle limit
  // Handle offset
}
