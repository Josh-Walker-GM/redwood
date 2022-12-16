import path from 'path'

import chalk from 'chalk'

import { RedwoodDiagnostics, RedwoodError, RedwoodWarning } from './diagnostic'

export abstract class RedwoodSkeleton implements RedwoodDiagnostics {
  warnings: RedwoodWarning[] = []
  errors: RedwoodError[] = []

  public readonly name: string

  constructor(public readonly filepath: string, name?: string) {
    this.name = name ?? path.parse(this.filepath).name // default to the file name if not given a specific name
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0
  }

  printWarnings(): void {
    if (this.warnings.length > 0) {
      const titleLine = `${chalk.bgYellow('[Warn]')}\t${this.name} ${chalk.dim(
        this.filepath
      )}`
      const warningLines = this.warnings.map((warning, index) => {
        return ` (${index + 1}) ${warning}\n`
      })
      console.log(titleLine.concat('\n', ...warningLines).trimEnd())
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  printErrors(): void {
    if (this.errors.length > 0) {
      const titleLine = `${chalk.bgRed('[Error]')}\t${this.name} ${chalk.dim(
        this.filepath
      )}`
      const errorLines = this.errors.map((error, index) => {
        return ` (${index + 1}) ${error}\n`
      })
      console.log(titleLine.concat('\n', ...errorLines).trimEnd())
    }
  }
}
