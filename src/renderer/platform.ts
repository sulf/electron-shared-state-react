export type StateChannel = string

export interface Platform {
  setStateForChannel<T>(
    channel: StateChannel,
    key: string,
    value: T | undefined,
    source: string | undefined,
  ): Promise<void>
  subscribeToKey<T>(
    channel: StateChannel,
    key: string,
    updatedValue: (_: any, _value: T) => void,
  ): () => void
  getStateForChannel<T>(
    channel: StateChannel,
    key: string,
  ): Promise<{ value: T | undefined; hasKey: boolean }>
}

let lazyPlatform: Platform | undefined

export const initializePlatform = (platform: Platform): void => {
  lazyPlatform = platform
}

export const platform: Platform = {
  get setStateForChannel() {
    if (!lazyPlatform) throw 'Platform not initialized (setStateForChannel)'
    return lazyPlatform.setStateForChannel
  },
  get subscribeToKey() {
    if (!lazyPlatform) throw 'Platform not initialized (subscribeToKey)'
    return lazyPlatform.subscribeToKey
  },
  get getStateForChannel() {
    if (!lazyPlatform) throw 'Platform not initialized (getStateForChannel)'
    return lazyPlatform.getStateForChannel
  },
}
