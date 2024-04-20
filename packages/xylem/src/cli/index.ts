import fs from 'node:fs'
import path from 'node:path'

import { pascalCase } from 'change-case'

import { getPaths } from '@redwoodjs/project-config'

import { getXylemDB } from '../util/index.js'

async function main() {
  console.log('~'.repeat(16), 'XYLEM', '~'.repeat(16))

  switch (process.argv[2]) {
    case 'setup':
      await setup()
      break
    case 'teardown':
      await teardown()
      break
    case 'migrate':
      await migrate()
      break
    case 'rollback':
      await rollback()
      break
    case 'state':
      await state()
      break
    case 'reset':
      await reset()
      break
    case 'metadata':
      await metadata()
      break
    default:
      console.log('Unknown command!')
      break
  }

  console.log('~'.repeat(39))
}

async function setup() {
  console.log('Setup...')
  const db = await getXylemDB()

  console.log('Setting up migration table...')
  await db.setupMigrationTable()
}

async function teardown() {
  console.log('Teardown...')
  const db = await getXylemDB()

  console.log('Tearing down migration table...')
  await db.teardownMigrationTable()
}

async function state() {
  console.log('State...')
  const db = await getXylemDB()

  console.log('Getting migration state...')
  const state = await db.listMigrationState()
  if (state.length === 0) {
    console.log('No migrations found')
    return
  }
  console.log('Migrations:')
  let countApplied = 0
  for (const { name, migratedAt, location } of state) {
    const line = [` - ${name}`]
    switch (location) {
      case 'local':
        line.push(`| local`)
        break
      case 'remote':
        line.push(`| remote`)
        break
      case 'both':
        line.push(`| local+remote`)
        break
    }
    if (migratedAt !== null) {
      countApplied += 1
      line.push(`| applied`)
      line.push(`| ${migratedAt.toISOString()}`)
    } else {
      line.push(`| not applied`)
    }
    console.log(line.join(' '))
  }
  console.log(`State: ${countApplied} of ${state.length} are applied`)
}

async function migrate() {
  console.log('Migrate...')
  const db = await getXylemDB()

  console.log('Getting migration state...')
  const state = await db.listMigrationState()
  if (state.length === 0) {
    console.log('No migrations found')
    return
  }

  console.log('Migrating...')
  for (const { name, migratedAt } of state) {
    if (migratedAt === null) {
      console.log(`Migrating ${name}...`)
      await db.executeMigration(name)
    }
  }
}

async function rollback() {
  console.log('Rollback...')
  const db = await getXylemDB()

  console.log('Getting migration state...')
  const state = await db.listMigrationState()
  if (state.length === 0) {
    console.log('No migrations found')
    return
  }

  console.log('Rolling back...')
  for (const { name, migratedAt } of state) {
    if (migratedAt !== null) {
      console.log(`Rolling back ${name}...`)
      await db.rollbackMigration(name)
    }
  }
}

async function reset() {
  console.log('Reset...')
  const db = await getXylemDB()

  console.log('Getting migration state...')
  const state = await db.listMigrationState()
  if (state.length === 0) {
    console.log('No migrations found')
    return
  }

  console.log('Rolling back all migrations...')
  for (const { name, migratedAt } of state) {
    if (migratedAt !== null) {
      console.log(`Rolling back ${name}...`)
      await db.rollbackMigration(name)
    }
  }

  console.log('Migrating all migrations...')
  for (const { name, migratedAt } of state) {
    if (migratedAt === null) {
      console.log(`Migrating ${name}...`)
      await db.executeMigration(name)
    }
  }
}

async function metadata() {
  console.log('Metadata...')
  const db = await getXylemDB()
  const meta = await db.generateMetadata()
  console.log('Metadata:')
  console.dir(meta, { depth: null })

  const lines: string[] = ['// This file is generated by Xylem\n']

  for (const model of meta.models) {
    const primaryKeyType = model.columns[model.primaryKey].type
    lines.push(`export interface T${pascalCase(model.name)} {`)
    lines.push(`  PrimaryKey: ${primaryKeyType}`)
    lines.push(`  Data: {`)
    for (const [name, column] of Object.entries(model.columns)) {
      lines.push(`    ${name}: ${column.type}`)
    }
    lines.push(`  }`)
    lines.push('}\n')
  }

  fs.writeFileSync(
    path.join(getPaths().api.src, 'xylem', 'types.ts'),
    lines.join('\n'),
  )
}

main()
