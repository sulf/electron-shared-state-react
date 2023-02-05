import { JsonArray, JsonObject, JsonScalar, JsonValue } from '../util/json'
import { Mutex } from 'async-mutex'
import { app } from 'electron'
import * as fs from 'fs'
import * as fspath from 'path'
import { buildKeyValueStore } from './buildKeyValueStore'
import { debugLog } from '../util/debugLog'

export type Disposable = {
  dispose: () => void
}

const settingsPath = (): string => {
  const path = fspath.join(app.getPath('userData'), `settings.json`)
  return path
}

const SYNC_TIMEOUT = 5_000

const AppDefaults: JsonObject = {}

const writeLock = new Mutex()

type Watcher = {
  key: string
  callback: (value: any, oldValue?: JsonValue) => void
}

let localState: Record<
  string,
  JsonScalar | JsonObject | JsonArray | undefined
> = {}
const watchers: Watcher[] = []

let syncTimer: NodeJS.Timeout | undefined

const syncSettings = async (force = false) => {
  if (syncTimer) {
    clearTimeout(syncTimer)
  }
  const sync = async () => {
    // insert into database
    const releaseLock = await writeLock.acquire()
    try {
      const data = JSON.stringify(localState)
      await new Promise<void>((resolve, reject) => {
        fs.writeFile(settingsPath(), data, (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        })
      })
    } catch (err) {
      console.error(`[Settings] Could not sync settings`, err)
    } finally {
      releaseLock()
    }
  }
  if (!force) {
    syncTimer = setTimeout(async () => {
      await sync()
      debugLog(`[Settings] Settings written to `, settingsPath())
    }, SYNC_TIMEOUT)
  } else {
    await sync()
  }
}

const setValue = async (
  key: string,
  value: JsonScalar | JsonObject | JsonArray | undefined,
): Promise<void> => {
  debugLog(`[Settings] setting ${key} to ${JSON.stringify(value)}`)
  const oldValue = localState[key]
  localState[key] = value

  // notify watchers
  watchers
    .filter((w) => w.key === key)
    .forEach((w) => {
      w.callback(value, oldValue)
    })

  await syncSettings()
  return Promise.resolve()
}

function getValueSync<T>(
  key: string,
  defaultValue?: T,
): JsonScalar | JsonObject | JsonArray | undefined | T {
  const val = localState[key]
  return val ?? defaultValue
}

function getValue<T>(
  key: string,
  defaultValue?: T,
): Promise<JsonScalar | JsonObject | JsonArray | undefined | T> {
  return Promise.resolve(getValueSync(key, defaultValue))
}

function watch<T extends JsonValue<any>>(
  key: string,
  callback: (value: T, oldValue?: T) => void,
): Disposable {
  debugLog(`[Settings] adding watcher: ${key} [${watchers.length}]`)
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

const hasKey = (key: string): Promise<boolean> => {
  const _hasKey = key in localState
  return Promise.resolve(_hasKey)
}

const clear = async (): Promise<void> => {
  if (writeLock?.isLocked()) {
    writeLock.release()
  }
  localState = {}
  await syncSettings(true)
}

const initialize = async (): Promise<void> => {
  let kvPairs: Record<string, JsonScalar | JsonObject | JsonArray | undefined> =
    {}

  if (fs.existsSync(settingsPath())) {
    try {
      const data = fs.readFileSync(settingsPath(), 'utf8')
      kvPairs = JSON.parse(data)
    } catch (e) {
      console.error('[Settings] Could not read settings.', e)
    }
  }

  // read all settings
  debugLog('[Settings] initialized')
  debugLog('[Settings] Pairs', kvPairs)
  localState = kvPairs

  // Apply defaults
  Object.keys(AppDefaults).forEach((key) => {
    if (!(key in localState)) {
      localState[key] = AppDefaults[key]
    }
  })
}

const store = buildKeyValueStore({
  channel: 'settings',
  setValue,
  getValue,
  hasKey,
})

export default {
  async ready(): Promise<void> {
    initialize()
    store.ready()
  },
  quit(): void {
    store.quit()
  },
  setValue,
  getValue,
  getValueSync,
  watch,
  clear,
}
