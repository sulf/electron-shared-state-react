import { BrowserWindow, WebContents } from 'electron'
import buildIPCListeners, { HandlerFn, ListenerFn } from './buildIPCListeners'
import { JsonArray, JsonObject, JsonScalar, JsonValue } from '../util/json'
import { debugLog } from '../util/debugLog'

type StoreProps = {
  channel: string
  setValue: (
    key: string,
    value: JsonScalar | JsonObject | JsonArray | undefined,
  ) => Promise<void>
  getValue: (
    key: string,
  ) => Promise<JsonScalar | JsonObject | JsonArray | undefined>
  hasKey: (key: string) => Promise<boolean>
}

export const buildKeyValueStore = ({
  channel,
  setValue,
  getValue,
  hasKey,
}: StoreProps): {
  ready: () => void
  quit: () => void
  notifyWatchersForKey: (key: string, value: any) => void
} => {
  const ipcListeners = buildIPCListeners()

  const watchers: {
    [key: string]: { sender: WebContents; count: number }[]
  } = {}

  const notifyWatchersForKey = (key: string, value: JsonValue): void => {
    if (watchers[key]) {
      watchers[key].forEach((watcher) => {
        watcher.sender.send(`${channel}:updatedValue:${key}`, value)
      })
    }
  }

  const getState: HandlerFn = async (
    _,
    key: string,
  ): Promise<{
    value: JsonScalar | JsonObject | JsonArray | undefined
    hasKey: boolean
  }> => {
    const value = await getValue(key)
    const _hasKey = await hasKey(key)
    return { value, hasKey: _hasKey }
  }

  const setState: HandlerFn = async (
    event,
    key: string,
    value: JsonScalar | JsonObject | JsonArray,
    source?: string,
  ): Promise<void> => {
    debugLog(
      `[${channel}] setState for key "${key}" (window: ${BrowserWindow.fromWebContents(
        event.sender,
      )?.getTitle()}, source: ${source ? source : 'unknown'})`,
    )

    setValue(key, value).catch((e) => {
      console.error(`[${channel}] setState for key "${key}" failed`, e)
    })
    // send update to all watchers for this key
    notifyWatchersForKey(key, value)
  }

  const watchKey: ListenerFn = async (e, key: string) => {
    if (watchers[e.sender.id]) {
      return
    }

    watchers[key] ||= []

    e.sender.once('destroyed', () => {
      const idx = watchers[key].findIndex((w) => w.sender === e.sender)
      if (idx > -1) {
        watchers[key].splice(idx, 1)
      }
    })

    const idx = watchers[key].findIndex((w) => w.sender.id === e.sender.id)
    if (idx === -1) {
      watchers[key].push({ sender: e.sender, count: 1 })
    } else {
      watchers[key][idx].count += 1
    }

    const val = await getValue(key)
    e.sender.send(`${channel}:updatedValue`, val)
  }

  const unwatchKey: ListenerFn = (e, key: string) => {
    const idx = watchers[key]?.findIndex((w) => w.sender.id === e.sender.id)
    if (idx > -1) {
      watchers[key][idx].count -= 1
      if (watchers[key][idx].count <= 0) {
        watchers[key].splice(idx, 1)
      }
    }
  }

  return {
    ready(): void {
      ipcListeners.addHandler(`${channel}:getState`, getState)
      ipcListeners.addHandler(`${channel}:setState`, setState)
      ipcListeners.addListener(`${channel}:watchKey`, watchKey)
      ipcListeners.addListener(`${channel}:unwatchKey`, unwatchKey)
    },
    quit(): void {
      ipcListeners.removeAll()
    },
    notifyWatchersForKey,
  }
}
