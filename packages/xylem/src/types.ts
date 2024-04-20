export type PromiseOr<T> = T | Promise<T>

export type Class = new (...args: any[]) => any
