export function generateUniqueVariablePlaceholder(values: Record<string, any>) {
  return `$x${Object.keys(values).length}`
}
