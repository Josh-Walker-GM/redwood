import {
  Ambition,
  AmbitionComparisonNode,
  AmbitionComparisonOperator,
  AmbitionEntryRead,
  AmbitionLogicalNode,
  AmbitionNodeValue,
} from '../ambition'

import { XylemManager } from './manager'

interface XylemModelType {
  PrimaryKey: any
  Data: Record<string | symbol, any>
}

type PrimaryKey<T extends XylemModelType> = T['PrimaryKey']
type Data<T extends XylemModelType> = T['Data']

type Constructor<T> = new (...args: any[]) => T

type ModelInstance<T extends XylemModelType> = InstanceType<
  Constructor<Data<T>>
>

function XylemModel<ModelType extends XylemModelType>() {
  const Model = class {
    // @ts-expect-error this will get used in the future
    #data: Data<ModelType>

    constructor(data: Data<ModelType>) {
      this.#data = data
    }

    static all(): Ambition<ModelType, ModelInstance<ModelType>[]> {
      const entry = new AmbitionEntryRead(
        XylemManager.instance.getTableName(this.name),
      )
      return new Ambition<ModelType, ModelInstance<ModelType>[]>(entry)
    }

    static find(
      primaryKey: PrimaryKey<ModelType>,
    ): Ambition<ModelType, ModelInstance<ModelType> | null>
    static find(
      primaryKey: PrimaryKey<ModelType>[],
    ): Ambition<ModelType, (ModelInstance<ModelType> | null)[]>

    static find(
      primaryKey: PrimaryKey<ModelType> | PrimaryKey<ModelType>[],
    ): Ambition<
      ModelType,
      ModelInstance<ModelType> | null | (ModelInstance<ModelType> | null)[]
    > {
      const entry = new AmbitionEntryRead(
        XylemManager.instance.getTableName(this.name),
      )
      const primaryKeyColumn = XylemManager.instance.getPrimaryKey(this.name)
      if (Array.isArray(primaryKey)) {
        entry.where = new AmbitionLogicalNode(
          primaryKeyColumn,
          'IN',
          primaryKey.map((pk) => new AmbitionNodeValue(pk)),
        )
      } else {
        entry.where = new AmbitionComparisonNode(
          primaryKeyColumn,
          AmbitionComparisonOperator.EQUAL,
          primaryKey,
        )
      }

      return new Ambition<
        ModelType,
        ModelInstance<ModelType> | null | (ModelInstance<ModelType> | null)[]
      >(entry)
    }

    //
  }

  return Model as Constructor<Data<ModelType>> & typeof Model
}

export { XylemModel }

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
