import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { IpcMainEvent } from 'electron/main'

export type ListenerFn = (e: IpcMainEvent, ...args: any[]) => void
export type HandlerFn = (
  event: IpcMainInvokeEvent,
  ...args: any[]
) => Promise<void> | any

const buildIPCListeners = (): {
  listeners: { [event: string]: ListenerFn }
  handlers: string[]
  addListener: (event: string, listener: ListenerFn) => void
  addHandler: (event: string, handler: HandlerFn) => void
  removeAll: () => void
} => {
  const listeners: { [event: string]: ListenerFn } = {}
  const handlers: string[] = []

  const addListener = (event: string, listener: ListenerFn) => {
    ipcMain.addListener(event, listener)
    listeners[event] = listener
  }

  const removeAllListeners = () => {
    Object.keys(listeners).forEach((event) => {
      ipcMain.removeListener(event, listeners[event])
      delete listeners[event]
    })
  }

  const addHandler = (event: string, handler: HandlerFn) => {
    ipcMain.handle(event, handler)
    handlers.push(event)
  }

  const removeAllHandlers = () => {
    handlers.forEach((event) => {
      ipcMain.removeHandler(event)
    })
    handlers.splice(0, handlers.length)
  }
  const removeAll = () => {
    removeAllHandlers()
    removeAllListeners()
  }

  return { listeners, handlers, addListener, addHandler, removeAll }
}

export default buildIPCListeners
