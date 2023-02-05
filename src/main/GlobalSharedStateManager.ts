import { Mutex } from 'async-mutex'
import { debugLog } from '../util/debugLog'
import { JsonArray, JsonObject, JsonScalar, JsonValue } from '../util/json'
import { buildKeyValueStore } from './buildKeyValueStore'

export type Disposable = {
  dispose: () => void
}

type Watcher = {
  key: string
  callback: (value: any, oldValue?: JsonValue) => void
}

let localState: Record<
  string,
  JsonScalar | JsonObject | JsonArray | undefined
> = {}
const writeLock = new Mutex()
const watchers: Watcher[] = []

const setValue = async (
  key: string,
  value: JsonScalar | JsonObject | JsonArray | undefined,
): Promise<void> => {
  const releaseLock = await writeLock.acquire()
  const oldValue = localState[key]
  localState[key] = value
  releaseLock()

  // notify watchers
  watchers
    .filter((w) => w.key === key)
    .forEach((w) => {
      w.callback(value, oldValue)
    })

  return Promise.resolve()
}

function getValue<T>(
  key: string,
): Promise<JsonScalar | JsonObject | JsonArray | undefined | T> {
  const val = localState[key]
  return Promise.resolve(val)
}

const hasKey = (key: string): Promise<boolean> => {
  const _hasKey = key in localState
  return Promise.resolve(_hasKey)
}

function watch<T extends JsonValue<any>>(
  key: string,
  callback: (value: T, oldValue?: T) => void,
): Disposable {
  debugLog(
    `[GlobalSharedStateManager] adding watcher: ${key} [${watchers.length}]`,
  )
  const watcher: Watcher = { key, callback } as Watcher
  watchers.push(watcher)
  return {
    dispose: () => {
      const idx = watchers.findIndex(
        (w) => w.key === key && w.callback === callback,
      )
      if (idx >= 0) {
        watchers.splice(idx, 1)
      }
    },
  }
}

const store = buildKeyValueStore({
  channel: 'globalState',
  setValue,
  getValue,
  hasKey,
})

const clear = (): void => {
  if (writeLock?.isLocked()) {
    writeLock.release()
  }
  localState = {}
}

const getValueSync = (
  key: string,
): JsonScalar | JsonObject | JsonArray | undefined => {
  const val = localState[key]
  return val
}

export default {
  ready(): void {
    store.ready()
  },
  quit(): void {
    store.quit()
  },
  setValue: async (
    key: string,
    value: JsonScalar | JsonObject | JsonArray | undefined,
  ): Promise<void> => {
    // write to database
    await setValue(key, value)
    // notify renderers
    store.notifyWatchersForKey(key, value)
  },
  getValue,
  getValueSync,
  watch,
  clear,
}
