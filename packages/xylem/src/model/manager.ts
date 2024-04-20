import { EventEmitter } from 'node:events'

import { pascalCase, snakeCase } from 'change-case'

import type { PreparedStatementData } from '../database/database'
import type { Metadata } from '../metadata'
import { getXylemDB } from '../util'

export class XylemManager {
  private static _instance: XylemManager

  private metadata: Metadata
  private loaded: boolean
  private verbose: boolean
  private events: EventEmitter

  private constructor() {
    this.metadata = {
      models: [],
    }
    this.loaded = false
    this.verbose = false

    this.events = new EventEmitter()
    this.events.on('plan', (plan: PreparedStatementData) => {
      if (this.verbose) {
        console.log(
          ['Xylem Plan:', plan.sql.join(' '), JSON.stringify(plan.values)].join(
            '\n',
          ),
        )
      }
    })
    this.events.on('execute', (plan: PreparedStatementData) => {
      if (this.verbose) {
        console.log(
          [
            'Xylem Execute:',
            plan.sql.join(' '),
            JSON.stringify(plan.values),
          ].join('\n'),
        )
      }
    })
    this.events.on('explain', (explain: string) => {
      if (this.verbose) {
        console.log(['Xylem Explain:', explain].join('\n'))
      }
    })
  }

  static get instance() {
    if (!this._instance) {
      this._instance = new XylemManager()
    }
    return this._instance
  }

  static async initialize() {
    await this.instance.initialize()
  }

  private async initialize() {
    if (this.loaded) {
      return
    }
    const db = await getXylemDB()
    this.metadata = await db.generateMetadata()
    this.loaded = true
  }

  static get verbose() {
    return this.instance.verbose
  }
  static set verbose(value: boolean) {
    this.instance.verbose = value
  }

  static get events() {
    return this.instance.events
  }

  getTableName(modelName: string): string {
    if (!this.loaded) {
      throw new Error('ModelConfigHelper not loaded')
    }

    return snakeCase(modelName)
  }

  getPrimaryKey(modelName: string): string {
    if (!this.loaded) {
      throw new Error('ModelConfigHelper not loaded')
    }

    const model = this.metadata.models.find(
      (m) => pascalCase(m.name) === modelName,
    )
    if (!model) {
      throw new Error(`Model not found: ${modelName}`)
    }
    return model.primaryKey
  }
}
