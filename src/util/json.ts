type NestedValue<TValue> = TValue | NestedArray<TValue> | NestedObject<TValue>
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface NestedArray<TValue> extends Array<NestedValue<TValue>> {}
interface NestedObject<TValue> {
  [key: string]: NestedValue<TValue>
}

export type JsonScalar<T = null> = null | boolean | number | string | Date | T
export type JsonValue<T = null> = NestedValue<JsonScalar<T>>
export type JsonObject<T = null> = NestedObject<JsonScalar<T>>
export type JsonArray<T = null> = NestedArray<JsonScalar<T>>
