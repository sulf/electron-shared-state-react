import { ipcRenderer } from 'electron'
import { Platform, StateChannel } from './platform'

function getStateForChannel<T>(
  channel: StateChannel,
  key: string,
): Promise<{ value: T; hasKey: boolean }> {
  return ipcRenderer.invoke(`${channel}:getState`, key)
}

function setStateForChannel<T>(
  channel: StateChannel,
  key: string,
  value: T | undefined,
  source: string | undefined,
): Promise<void> {
  return ipcRenderer.invoke(`${channel}:setState`, key, value, source)
}

function subscribeToKey<T>(
  channel: StateChannel,
  key: string,
  updatedValue: (_: any, _value: T) => void,
): () => void {
  ipcRenderer.addListener(`${channel}:updatedValue:${key}`, updatedValue)
  ipcRenderer.send(`${channel}:watchKey`, key)

  getStateForChannel(channel, key).then((result) => {
    updatedValue(key, result.value as T)
  })

  return () => {
    ipcRenderer.removeListener(`${channel}:updatedValue:${key}`, updatedValue)
    ipcRenderer.send(`${channel}:unwatchKey`, key)
  }
}

export const rendererPlatform: Platform = {
  setStateForChannel,
  subscribeToKey,
  getStateForChannel,
}
