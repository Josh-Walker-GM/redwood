export interface Metadata {
  models: ModelMetadata[]
}

export interface ModelMetadata {
  name: string
  columns: Record<string, ColumnMetadata>
  primaryKey: keyof ColumnMetadata
}

export interface ColumnMetadata {
  type: 'string' | 'number' | 'any'
  isPrimaryKey: boolean
  isUnique: boolean
}
