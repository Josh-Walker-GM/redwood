import {
  Ambition,
  AmbitionComparisonNode,
  AmbitionComparisonOperator,
  AmbitionEntryRead,
  AmbitionLogicalNode,
  AmbitionNodeValue,
} from '../ambition'

type Constructor = new (...args: any[]) => any
type XylemModelTypical = Constructor & {
  tableName?: string
  primaryKey?: string
}

type XylemModelBaseTypings = {
  PrimaryKey: any
  Column: Record<string, any>
}

function XylemModelFactory<M extends XylemModelBaseTypings>() {
  return function <T extends XylemModelTypical>(Base: T) {
    // TODO(jgmw): We should ensure a specific casing for the table name?
    const tableName = Base.tableName ?? Base.name
    if (!tableName) {
      throw new Error(
        'Unable to determine table name for model and no tableName static property was provided',
      )
    }

    const primaryKey = Base.primaryKey ?? 'id'
    if (!primaryKey) {
      throw new Error('Cannot provide a falsy value for the primaryKey')
    }

    // It is not possible to have hidden or private properties in an exported
    // class in TypeScript. Instead, we use a WeakMap to store the hidden data
    // for each instance of the class.
    const hiddenDataStore = new WeakMap<object, M['Column']>()

    return class extends Base {
      private constructor(...data: any[]) {
        super(data)
        hiddenDataStore.set(this, {})
      }

      static get tableName(): string {
        return tableName
      }

      static get primaryKey(): string {
        return primaryKey
      }

      static new(data: M['Column']): InstanceType<T> {
        const target = new this()
        const proxy = new Proxy<InstanceType<T>>(target, {})
        for (const [key, value] of Object.entries(data)) {
          proxy[key] = value
        }
        return proxy
      }

      static all(): Ambition<T, InstanceType<T>[]> {
        const entry = new AmbitionEntryRead(this.tableName)
        return new Ambition<T, InstanceType<T>[]>(entry)
      }

      static find(
        primaryKey: M['PrimaryKey'],
      ): Ambition<T, InstanceType<T> | null>
      static find(
        primaryKey: M['PrimaryKey'][],
      ): Ambition<T, (InstanceType<T> | null)[]>

      static find(
        primaryKey: M['PrimaryKey'] | M['PrimaryKey'][],
      ): Ambition<T, InstanceType<T> | null | (InstanceType<T> | null)[]> {
        const entry = new AmbitionEntryRead(this.tableName)
        if (Array.isArray(primaryKey)) {
          entry.where = new AmbitionLogicalNode(
            this.primaryKey,
            'IN',
            primaryKey.map((pk) => new AmbitionNodeValue(pk)),
          )
        } else {
          entry.where = new AmbitionComparisonNode(
            this.primaryKey,
            AmbitionComparisonOperator.EQUAL,
            primaryKey,
          )
        }

        return new Ambition<
          T,
          InstanceType<T> | null | (InstanceType<T> | null)[]
        >(entry)
      }

      save(): void {
        // TODO(jgmw): Implement
      }
    }
  }
}

export { XylemModelFactory }

// ---

//   static async find(_primayKey: any | any[]) {
//     throw new Error('Not implemented')
//     // Should select the record(s) with the given primary key(s)
//     // If the primary key is a single value, return a single object
//     // If the primary key is an array, return an array of objects
//     // If no record is found with the given primary key(s), return null
//     // If the primary key is invalid, throw an error
//   }

//   static async take(_count?: number) {
//     throw new Error('Not implemented')
//     // Should select the first n records
//     // If n is not provided, return the first record
//     // If no record is found, return null
//   }

//   static async first() {
//     throw new Error('Not implemented')
//     // Should select the first record ordered by the primary key
//     // If no record is found, return null
//   }

//   static async last() {
//     throw new Error('Not implemented')
//     // Should select the last record ordered by the primary key
//     // If no record is found, return null
//   }

//   // static
//   // findBy - sugar for where + take
//   // findEach - 2.2.1 retrieves records in batches and then yields each one to the block
//   // findInBatches - 2.2.2 retrieves records in batches, yielding each batch to the block

//   // static
//   // where - should return a new query object with the given conditions
//   //   - have to deal with not, or, and, etc.

//   // static
//   // order - should return a new query object with the given order

//   // static
//   // select - should return a new query object with the given select

//   // static
//   // limit - should return a new query object with the given limit

//   // static
//   // offset - should return a new query object with the given offset

//   // static
//   // group - should return a new query object with the given group

//   // static
//   // having - should return a new query object with the given having

//   // readonly - locks the object so that it can't be modified

//   // locking
//   //   - optimistic - uses a version number stored on the model (and db) to detect conflicts
//   //   - pessimistic - locks the record using the db primitives for the duration of the transaction

//   // eager / lazy loading
//   //   - eager - loads the associated records when the parent record is loaded

//   // enums
//   //   - should be able to define enums on the model

//   // exists
//   //   - should return true if a record exists with the given conditions

//   // calculations
//   //   - count - should return the number of records that match the conditions
//   //   - average - should return the arithmetic mean of the given column
//   //   - sum - should return the sum of the given column
//   //   - minimum - should return the minimum value of the given column
//   //   - maximum - should return the maximum value of the given column

//   // explain
//   //   - should return the query plan for the query
