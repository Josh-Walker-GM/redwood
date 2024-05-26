import fs from 'node:fs'
import path from 'node:path'

import sqlite3 from 'sqlite3'

import { getPaths } from '@redwoodjs/project-config'

import type { AmbitionEntry } from '../../ambition'
import type { ColumnMetadata, Metadata, ModelMetadata } from '../../metadata'
import { XylemManager } from '../../model/manager'
import type {
  MigrationState,
  PreparedStatementData,
  TBaseSchema,
  TTableBuilderCallback,
} from '../database'
import { Database, BaseColumnBuilder, BaseTableBuilder } from '../database'
import { isSafeSqlName } from '../utilities'

import { buildStatement } from './builder/index'

type ProviderInstance = InstanceType<typeof sqlite3.Database>
class SQLiteDatabase extends Database<ProviderInstance> {
  schema: SQLiteSchema

  constructor(url: string) {
    super()

    sqlite3.verbose()
    const provider = new sqlite3.Database(url)

    this.provider = provider
    this.schema = new SQLiteSchema(provider)

    this.ready = true
  }

  async setupMigrationTable() {
    const tableExists = await this.schema.hasTable(
      Database.MIGRATION_TABLE_NAME,
    )
    if (tableExists) {
      throw new Error(
        `Migration table "${Database.MIGRATION_TABLE_NAME}" already exists`,
      )
    }

    await this.schema.createTable(Database.MIGRATION_TABLE_NAME, (table) => {
      table.text('name').primary()
      table.numeric('migrated_at').default('CURRENT_TIMESTAMP').nullable()
    })
  }

  async teardownMigrationTable() {
    const tableExists = await this.schema.hasTable(
      Database.MIGRATION_TABLE_NAME,
    )
    if (!tableExists) {
      return
    }

    await this.schema.dropTable(Database.MIGRATION_TABLE_NAME)
  }

  async listMigrationState(): Promise<MigrationState[]> {
    const tableExists = this.schema.hasTable(Database.MIGRATION_TABLE_NAME)
    if (!tableExists) {
      throw new Error(
        `Migration table "${Database.MIGRATION_TABLE_NAME}" does not exist`,
      )
    }

    const remoteState = await new Promise<
      { name: string; migratedAt: Date | null; location: 'remote' }[]
    >((resolve, reject) => {
      this.provider.all(
        `SELECT name, migrated_at FROM ${Database.MIGRATION_TABLE_NAME}`,
        [],
        (err, rows) => {
          if (err) {
            reject(err)
          }

          const state = (rows as { name: string; migrated_at: string }[]).map(
            (row) => ({
              name: row.name,
              migratedAt: row.migrated_at ? new Date(row.migrated_at) : null,
              location: 'remote' as const,
            }),
          )
          resolve(state)
        },
      )
    })

    const localState = []
    const migrationDirectory = path.join(
      getPaths().api.src,
      'xylem',
      'migrations',
    )
    if (
      fs.existsSync(migrationDirectory) &&
      fs.statSync(migrationDirectory).isDirectory()
    ) {
      const files = fs.readdirSync(migrationDirectory)
      for (const file of files) {
        localState.push({
          name: path.basename(file, path.extname(file)),
          migratedAt: null,
          location: 'local' as const,
        })
      }
    }

    const combinedState = []
    for (const local of localState) {
      const remote = remoteState.find((r) => r.name === local.name)
      if (remote) {
        combinedState.push({
          name: local.name,
          migratedAt: remote.migratedAt,
          location: 'both' as const,
        })
      } else {
        combinedState.push(local)
      }
    }
    for (const remote of remoteState) {
      if (!localState.find((l) => l.name === remote.name)) {
        combinedState.push(remote)
      }
    }

    return combinedState.sort((a, b) => a.name.localeCompare(b.name))
  }

  async executeMigration(name: string) {
    const migrationPath = path.join(
      getPaths().api.dist,
      'xylem',
      'migrations',
      name + '.js',
    )
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }

    const { up: execUp } = await import(`file://${migrationPath}`)
    await execUp(this.schema)

    await new Promise<void>((resolve, reject) => {
      this.provider.run(
        `INSERT INTO ${Database.MIGRATION_TABLE_NAME} (name, migrated_at) VALUES ($name, CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET migrated_at=CURRENT_TIMESTAMP`,
        {
          $name: name,
        },
        (err) => {
          if (err) {
            reject(err)
          }
          resolve()
        },
      )
    })
  }

  async rollbackMigration(name: string) {
    const migrationPath = path.join(
      getPaths().api.dist,
      'xylem',
      'migrations',
      name + '.js',
    )
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }

    const { down: execDown } = await import(`file://${migrationPath}`)
    await execDown(this.schema)

    await new Promise<void>((resolve, reject) => {
      this.provider.run(
        `INSERT INTO ${Database.MIGRATION_TABLE_NAME} (name, migrated_at) VALUES ($name, NULL) ON CONFLICT(name) DO UPDATE SET migrated_at=NULL`,
        {
          $name: name,
        },
        (err) => {
          if (err) {
            reject(err)
          }
          resolve()
        },
      )
    })
  }

  async generateMetadata(): Promise<Metadata> {
    const list = await this.listMigrationState()

    const schemaMetadata = new SQLiteSchemaMetadata()
    for (const { name } of list) {
      const migrationPath = path.join(
        getPaths().api.dist,
        'xylem',
        'migrations',
        name + '.js',
      )
      const { up: execUp } = await import(`file://${migrationPath}`)
      await execUp(schemaMetadata)
    }

    return {
      models: schemaMetadata.models,
    }
  }

  async plan(ambitionEntry: AmbitionEntry) {
    const plan = buildStatement(ambitionEntry)
    XylemManager.events.emit('plan', plan)
    return plan
  }

  async execute(ambitionEntry: AmbitionEntry) {
    const plan = await this.plan(ambitionEntry)
    if (XylemManager.autoExplain) {
      await this.explainPlan(plan)
    }
    const result = await new Promise<any>((resolve, reject) => {
      this.provider.all(plan.sql.join(' '), plan.values, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
    XylemManager.events.emit('execute', plan, result)
    return result
  }

  async explain(ambitionEntry: AmbitionEntry) {
    const plan = await this.plan(ambitionEntry)
    return this.explainPlan(plan)
  }

  async explainPlan(plan: PreparedStatementData) {
    const query = `EXPLAIN QUERY PLAN ${plan.sql.join(' ')}`
    const explain = await new Promise<string>((resolve, reject) => {
      this.provider.all(query, plan.values, (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        resolve(rows?.map((r) => JSON.stringify(r)).join('\n'))
      })
    })
    XylemManager.events.emit('explain', plan, explain)
    return explain
  }
}

class SQLiteSchemaMetadata implements TBaseSchema<SQLiteTableBuilder> {
  models: ModelMetadata[]

  constructor() {
    this.models = []
  }

  async hasTable(name: string) {
    return this.models.some((model) => model.name === name)
  }

  async createTable(
    name: string,
    callback: TTableBuilderCallback<SQLiteTableBuilder>,
  ) {
    const tableBuilder = new SQLiteTableBuilder(name)
    await callback(tableBuilder)

    const meta = tableBuilder.toMetadata()
    this.models.push(meta)
  }

  async updateTable(
    _name: string,
    _callback: TTableBuilderCallback<SQLiteTableBuilder>,
  ) {
    throw new Error('Method not implemented.')
  }

  async renameTable(oldName: string, newName: string) {
    if (!isSafeSqlName(oldName)) {
      throw new Error(`Invalid table name: ${oldName}`)
    }
    if (!isSafeSqlName(newName)) {
      throw new Error(`Invalid table name: ${newName}`)
    }
    const model = this.models.find((model) => model.name === oldName)
    if (!model) {
      throw new Error(`Table not found: ${oldName}`)
    }
    model.name = newName
  }

  async dropTable(name: string) {
    if (!isSafeSqlName(name)) {
      throw new Error(`Invalid table name: ${name}`)
    }
    this.models = this.models.filter((model) => model.name !== name)
  }
}

class SQLiteSchema implements TBaseSchema<SQLiteTableBuilder> {
  private provider: ProviderInstance
  constructor(provider: ProviderInstance) {
    this.provider = provider
  }

  async hasTable(name: string) {
    return new Promise<boolean>((resolve, reject) => {
      this.provider.get(
        'SELECT name FROM sqlite_master WHERE type="table" AND name=$name',
        {
          $name: name,
        },
        (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row !== undefined)
          }
        },
      )
    })
  }

  async createTable(
    name: string,
    callback: TTableBuilderCallback<SQLiteTableBuilder>,
  ) {
    const tableBuilder = new SQLiteTableBuilder(name)
    await callback(tableBuilder)
    return new Promise<void>((resolve, reject) => {
      this.provider.run(tableBuilder.toSQL(), [], (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  async updateTable(
    _name: string,
    _callback: TTableBuilderCallback<SQLiteTableBuilder>,
  ) {
    throw new Error('Method not implemented.')
  }

  async renameTable(oldName: string, newName: string) {
    if (!isSafeSqlName(oldName)) {
      throw new Error(`Invalid table name: ${oldName}`)
    }
    if (!isSafeSqlName(newName)) {
      throw new Error(`Invalid table name: ${newName}`)
    }
    return new Promise<void>((resolve, reject) => {
      this.provider.run(
        `ALTER TABLE ${oldName} RENAME TO ${newName}`,
        [],
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        },
      )
    })
  }

  async dropTable(name: string) {
    if (!isSafeSqlName(name)) {
      throw new Error(`Invalid table name: ${name}`)
    }
    return new Promise<void>((resolve, reject) => {
      this.provider.run(`DROP TABLE ${name}`, [], (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

class SQLiteTableBuilder extends BaseTableBuilder {
  increments(name: string): SQLiteColumnBuilder {
    return this.integer(name)
      .addModifier('primary_key', 'PRIMARY KEY')
      .addModifier('autoincrement', 'AUTOINCREMENT')
  }

  createdAt(): SQLiteColumnBuilder {
    return this.numeric('created_at').default('CURRENT_TIMESTAMP')
  }

  updatedAt(): SQLiteColumnBuilder {
    return this.numeric('updated_at').default('CURRENT_TIMESTAMP')
  }

  // ---

  integer(name: string): SQLiteColumnBuilder {
    const column = new SQLiteColumnBuilder(name, 'INTEGER')
    this.addColumn(column)
    return column
  }

  text(name: string): SQLiteColumnBuilder {
    const column = new SQLiteColumnBuilder(name, 'TEXT')
    this.addColumn(column)
    return column
  }

  blob(name: string): SQLiteColumnBuilder {
    const column = new SQLiteColumnBuilder(name, 'BLOB')
    this.addColumn(column)
    return column
  }

  real(name: string): SQLiteColumnBuilder {
    const column = new SQLiteColumnBuilder(name, 'REAL')
    this.addColumn(column)
    return column
  }

  numeric(name: string): SQLiteColumnBuilder {
    const column = new SQLiteColumnBuilder(name, 'NUMERIC')
    this.addColumn(column)
    return column
  }

  // ---

  index(_columnName: string | string[], _indexName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  unique(_columnName: string | string[], _indexName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  renameIndex(_oldName: string, _newName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  dropPrimary(_indexName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  dropIndex(_indexName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  dropUnique(_ndexName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }
}

const SQLITE_COLUMN_TYPES = [
  'INTEGER',
  'TEXT',
  'REAL',
  'BLOB',
  'NUMERIC',
] as const
export type SQLiteColumnType = (typeof SQLITE_COLUMN_TYPES)[number]

const SQLITE_COLLATIONS = ['BINARY', 'NOCASE', 'RTRIM'] as const
export type SQLiteCollation = (typeof SQLITE_COLLATIONS)[number]

class SQLiteColumnBuilder extends BaseColumnBuilder {
  constructor(name: string, type: SQLiteColumnType) {
    super(name, type)

    if (!SQLITE_COLUMN_TYPES.includes(type)) {
      throw new Error(`Invalid column type: ${type}`)
    }
  }

  toMetadata(): ColumnMetadata {
    let tsType: ColumnMetadata['type'] = 'any'
    switch (this.type as SQLiteColumnType) {
      case 'INTEGER':
        tsType = 'number'
        break
      case 'REAL':
        tsType = 'number'
        break
      case 'TEXT':
        tsType = 'string'
        break
      case 'BLOB':
        tsType = 'any'
        break
      case 'NUMERIC':
        tsType = 'any'
        break
    }
    return {
      type: tsType,
      isPrimaryKey: this.modifiers.has('primary_key'),
      isUnique: this.modifiers.has('unique'),
    }
  }

  // ---

  collation(collation: SQLiteCollation): this {
    if (!SQLITE_COLLATIONS.includes(collation)) {
      throw new Error(`Invalid collation: ${collation}`)
    }

    this.modifiers.set('collation', `COLLATE ${collation}`)
    return this
  }

  default(value: any): this {
    this.modifiers.set('default', `DEFAULT ${value}`)
    return this
  }

  // ---

  primary(): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  index(): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }

  unique(): this {
    this.modifiers.set('unique', 'UNIQUE')
    return this
  }

  // ---

  references(_tableName: string, _columnName: string): this {
    // TODO(jgmw): Implement
    throw new Error('Method not implemented.')
  }
}

// ---

export async function sqlite(url: string): Promise<SQLiteDatabase> {
  const db = new SQLiteDatabase(url)
  await db.blockUntilReady()
  return db
}
