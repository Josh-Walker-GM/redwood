import fs from 'node:fs'
import path from 'node:path'

import { getPaths } from '@redwoodjs/project-config'

import type { Database } from '../database/database'

export async function getXylemDB() {
  const xylemDbPath = path.join(getPaths().api.dist, 'xylem', 'db.js')
  if (!fs.existsSync(xylemDbPath)) {
    throw new Error(`Xylem database not found! (${xylemDbPath})`)
  }

  const xylemDb: {
    db: Promise<Database<unknown>>
  } = await import(`file://${xylemDbPath}`)
  const db = await xylemDb.db
  return db
}
