# Xylem

My take on redoing redwood record 😬

## Idea

- ORM for redwood that is not tied to Prisma
- Supposed to feel like Rails ActiveRecord or Laravel Eloquent
- Migrations are the ultimate source of truth which everything else is built upon
- Typescript supported by default

## Still to work out:
  - Migrations (https://laravel.com/docs/11.x/migrations)
    - Modifying existing tables
    - Modifying existing columns
    - Properly implement keys
      - primary
      - unique
      - foreign
    - Drop columns

  - Seeding
    - snaplet like behaviour would be awesome

  - Scenarios
    - Not seeds - the Rob way of thinking about things
  
  - Models
    - specify table
    - specify primary key
      - don't support composite
      - can specify if it's auto incrementing 
      - can specify if it's not an integer
      - support uuid
      - support ulid
    - timestamps
      - can toggle off createdAt
      - can toggle off updatedAt
      - can set the names of the column for each
      - can set the date format - used when serialized into db or otherwise 
    - defaults
    - methods (static)
      - all
      - where
      - find
      - find or create
      - upsert
      - truncate
      - destroy
    - methods (on result of static)
      - update
      - count
      - delete
    - methods (instance)
      - refresh
      - save (insert/update)
      - isClean
      - isDirty
      - wasChanged
      - delete
      - is and isNot (comparison)
    - relationships
      - default result ?
      - 1-1
        - has one
        - belongs to
      - 1-n
        - has many
        - belongs to
        - latest of many / oldest of many (utils)
      - 1-x-1
        - has one through
      - 1-x-n
        - has many through
      - n-n
        - many to many
          - belongs to many
        - access the pivot table
      - polymorphic relationships
        - 1-1
        - 1-n
        - n-n
      - eager vs lazy loading relations
      - parent timestamps
    - methods on collections
      - unique
      - set hidden
      - set visible
      - only
      - make hidden
      - make visible
      - keys
      - load relation
      - load missing relations
      - intersect
      - fresh
      - find
      - except
      - diff
      - contains
      - append?
    - mutators
      - accessors (during access)
      - mutator (during set)
      - casts
        - defined on the model, like int under the hood to a bool 
        - array
        - json
        - enums
        - encryption
      - serialization
        - to/from array
        - to/from json
        - hide attributes during 
        - dates

  - future extensions
    - soft deletes
    - pruning
    - events 


