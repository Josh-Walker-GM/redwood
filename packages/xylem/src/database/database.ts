import type { AmbitionEntry } from '../ambition'
import type { ColumnMetadata, Metadata, ModelMetadata } from '../metadata'
import type { PromiseOr } from '../types'

import { isSafeSqlName } from './utilities'
export interface TBaseSchema<TTableBuilderType> {
  hasTable(tableName: string): PromiseOr<boolean>
  createTable(
    name: string,
    builder: TTableBuilderCallback<TTableBuilderType>,
  ): PromiseOr<void>
  updateTable(
    name: string,
    builder: TTableBuilderCallback<TTableBuilderType>,
  ): PromiseOr<void>
  renameTable(oldName: string, newName: string): PromiseOr<void>
  dropTable(name: string): PromiseOr<void>
}

export type TTableBuilderCallback<TTableBuilderType> = (
  table: Omit<TTableBuilderType, 'addColumn' | 'toSQL' | 'toMetadata'>,
) => PromiseOr<void>

export abstract class BaseTableBuilder {
  protected name: string
  private columnNames: Set<string>
  private columns: BaseColumnBuilder[]

  constructor(name: string) {
    if (!isSafeSqlName(name)) {
      throw new Error(`Invalid table name: ${name}`)
    }

    this.name = name
    this.columnNames = new Set<string>()
    this.columns = []
  }

  toSQL(): string {
    const lines = [`CREATE TABLE ${this.name}`]
    lines.push('(')
    for (let i = 0; i < this.columns.length; i++) {
      lines.push(this.columns[i].toSQL())
      if (i < this.columns.length - 1) {
        lines.push(',')
      }
    }
    lines.push(')')
    return lines.join('\n')
  }

  toMetadata(): ModelMetadata {
    const columns = Object.fromEntries(
      this.columns.map((column) => [column.getName(), column.toMetadata()]),
    )

    // Note: This does not handle composite primary keys
    let primaryKey = 'id'
    for (const [name, column] of Object.entries(columns)) {
      if (column.isPrimaryKey) {
        primaryKey = name
        break
      }
    }

    return {
      name: this.name,
      columns,
      // @ts-expect-error - Have to type this such that it's a key of columns record
      primaryKey,
    }
  }

  addColumn(column: BaseColumnBuilder): void {
    const incomingName = column.getName()
    if (this.columnNames.has(incomingName)) {
      throw new Error(`Column name ${incomingName} already added!`)
    }
    this.columnNames.add(incomingName)
    this.columns.push(column)
  }

  // ---

  abstract increments(name: string): BaseColumnBuilder
  abstract createdAt(): BaseColumnBuilder
  abstract updatedAt(): BaseColumnBuilder

  // ---

  abstract index(columnName: string | string[], indexName: string): this
  abstract unique(columnName: string | string[], indexName: string): this

  abstract renameIndex(oldName: string, newName: string): this

  abstract dropPrimary(indexName: string): this
  abstract dropIndex(indexName: string): this
  abstract dropUnique(indexName: string): this
}

export abstract class BaseColumnBuilder {
  protected name: string
  protected type: string

  protected modifiers: Map<string, string>

  constructor(name: string, type: string) {
    if (!isSafeSqlName(name)) {
      throw new Error(`Invalid table name: ${name}`)
    }

    this.name = name
    this.type = type
    this.modifiers = new Map<string, string>()
    this.addModifier('nullable', 'NOT NULL') // By default, columns are not nullable
  }

  toSQL(): string {
    const lines = [`${this.name} ${this.type}`]
    for (const modifier of this.modifiers.values()) {
      lines.push(modifier)
    }
    return lines.join(' ')
  }

  abstract toMetadata(): ColumnMetadata

  getName(): string {
    return this.name
  }

  addModifier(key: string, value: string): this {
    if (this.modifiers.has(key)) {
      throw new Error(`Modifier ${key} already set!`)
    }
    this.modifiers.set(key, value)
    return this
  }

  // ---

  nullable(): this {
    this.modifiers.delete('nullable')
    return this
  }

  abstract default(value: any): this
  abstract collation(collation: string): this

  // ---

  abstract primary(): this
  abstract index(): this
  abstract unique(): this

  // ---

  abstract references(tableName: string, columnName: string): this
}

export type PreparedStatementData = {
  sql: string[]
  values: Record<string, string>
}

export abstract class Database<TProvider> {
  // Constants
  static readonly MIGRATION_TABLE_NAME = '_xylem_migrations'

  // The underlying database provider (e.g. the sqlite3 package when using sqlite)
  protected provider: TProvider

  // The schema object which provides methods for interacting with the database
  abstract schema: TBaseSchema<BaseTableBuilder>

  // Flag which can be used to ensure any async setup has completed
  protected ready: PromiseOr<boolean>

  // NOTE: The constructor should be overloaded by the subclass
  constructor() {
    this.provider = undefined as unknown as TProvider
    this.ready = false
  }

  async blockUntilReady(): Promise<void> {
    await this.ready
  }

  // Migration management
  abstract setupMigrationTable(): PromiseOr<void>
  abstract teardownMigrationTable(): PromiseOr<void>
  abstract listMigrationState(): PromiseOr<MigrationState[]>
  abstract executeMigration(name: string): PromiseOr<void>
  abstract rollbackMigration(name: string): PromiseOr<void>

  // Metadata
  abstract generateMetadata(): PromiseOr<Metadata>

  // Query/Statement execution
  abstract plan(ambition: AmbitionEntry): PromiseOr<PreparedStatementData>
  abstract execute(ambition: AmbitionEntry): PromiseOr<any>
  abstract explain(ambition: AmbitionEntry): PromiseOr<string>
}

export interface MigrationState {
  name: string
  migratedAt: Date | null
  location: 'local' | 'remote' | 'both'
}
