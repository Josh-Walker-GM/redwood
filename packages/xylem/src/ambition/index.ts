import type { Database } from '../database/database'
import { getXylemDB } from '../util'

export class Ambition<_TModel, TReturn> {
  private db: Promise<Database<unknown>>
  private entry: AmbitionEntry

  constructor(entry: AmbitionEntry) {
    this.entry = entry

    this.db = getXylemDB()
  }

  async plan() {
    return (await this.db).plan(this.entry)
  }

  async explain() {
    return (await this.db).explain(this.entry)
  }

  async execute(): Promise<TReturn> {
    return (await this.db).execute(this.entry)
  }
}

export abstract class AmbitionEntry {
  abstract type: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  tableName: string

  constructor(tableName: string) {
    this.tableName = tableName
  }
}

export type AmbitionEntryReadWhereNodeType =
  | 'AmbitionComparisonNode'
  | 'AmbitionLogicalNode'

export class AmbitionEntryRead extends AmbitionEntry {
  readonly type: 'READ'

  from: string
  columns: string[]
  where: AmbitionNode<AmbitionEntryReadWhereNodeType> | null
  groups: string[]
  having: AmbitionNode<AmbitionNodeType> | null
  order: AmbitionNode<AmbitionNodeType> | null
  orderMode: 'ASC' | 'DESC'
  limit: number | null
  offset: number | null

  constructor(tableName: string) {
    super(tableName)
    this.type = 'READ'

    this.from = tableName
    this.columns = []
    this.where = null
    this.groups = []
    this.having = null
    this.order = null
    this.orderMode = 'ASC'
    this.limit = null
    this.offset = null
  }
}

type AmbitionNodeType =
  | 'AmbitionNodeValue'
  | 'AmbitionSelectionNode'
  | 'AmbitionComparisonNode'
  | 'AmbitionLogicalNode'

abstract class AmbitionNode<T extends AmbitionNodeType> {
  abstract type: T
  constructor() {}
}

export class AmbitionNodeValue extends AmbitionNode<'AmbitionNodeValue'> {
  type = 'AmbitionNodeValue' as const
  value: any

  constructor(value: any) {
    super()
    this.value = value
  }
}

export class AmbitionSelectionNode extends AmbitionNode<'AmbitionSelectionNode'> {
  type = 'AmbitionSelectionNode' as const
  columns: string[]

  constructor(columns: string[]) {
    super()
    this.columns = columns
  }
}

export enum AmbitionComparisonOperator {
  'EQUAL',
  'NOT_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
}
export class AmbitionComparisonNode extends AmbitionNode<'AmbitionComparisonNode'> {
  type = 'AmbitionComparisonNode' as const
  column: string
  operator: AmbitionComparisonOperator
  value: any

  constructor(
    column: string,
    operator: AmbitionComparisonOperator,
    value: any,
  ) {
    super()
    this.column = column
    this.operator = operator
    this.value = value
  }
}

export type AmbitionLogicalOperator =
  | 'ALL'
  | 'AND'
  | 'ANY'
  | 'BETWEEN'
  | 'EXISTS'
  | 'IN'
  | 'LIKE'
  | 'NOT'
  | 'OR'
  | 'SOME'
export class AmbitionLogicalNode extends AmbitionNode<'AmbitionLogicalNode'> {
  type = 'AmbitionLogicalNode' as const
  column: string
  operator: AmbitionLogicalOperator
  nodes: AmbitionNode<AmbitionNodeType>[]

  constructor(
    column: string,
    operator: AmbitionLogicalOperator,
    nodes: AmbitionNode<AmbitionNodeType>[],
  ) {
    super()
    this.column = column
    this.operator = operator
    this.nodes = nodes
  }
}
