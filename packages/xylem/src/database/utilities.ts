const safeSqlNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

// This function is designed to be a simple check for values which cannot be
// supplied as a prepared statement parameter - e.g. table names, column names,
// etc.
export function isSafeSqlName(name: string) {
  return safeSqlNameRegex.test(name)
}
