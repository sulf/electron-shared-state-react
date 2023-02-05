import { platform } from './platform'
import useFetchStateFromIPC from './useFetchStateFromIPC'

// Primarily to use outside of tsx components
export async function fetchSettings<T = any>(key: string): Promise<T> {
  const { value } = await platform.getStateForChannel('settings:getState', key)
  return value as unknown as T
}

export async function setSetting<T = any>(
  key: string,
  _value: T,
): Promise<void> {
  return platform.setStateForChannel(
    'settings:setState',
    key,
    _value,
    'renderer',
  )
}

// DEV: When you switch in live-reload useState to useSettings, we lose ref counting. It is advised
//      to restart your build to avoid unknown side effects
function useSettings<T>(
  key: string,
  defaultValue: T,
): [value: T, setValue: (value: T) => void]
function useSettings<T>(
  key: string,
  defaultValue?: undefined,
): [value: T | undefined, setValue: (value: T) => void]
function useSettings<T>(
  key: string,
  defaultValue?: T,
): [value: T | undefined, setValue: (value: T) => void] {
  return useFetchStateFromIPC('settings', key, defaultValue)
}

export { useSettings }
