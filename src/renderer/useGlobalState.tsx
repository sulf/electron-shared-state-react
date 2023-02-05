import { platform } from './platform'
import useFetchStateFromIPC from './useFetchStateFromIPC'

export async function fetchGlobalState<T = any>(key: string): Promise<T> {
  const { value } = await platform.getStateForChannel(
    'globalState:getState',
    key,
  )
  return value as unknown as T
}

export async function setGlobalState<T = any>(
  key: string,
  _value: T,
): Promise<void> {
  return platform.setStateForChannel(
    'globalState:setState',
    key,
    _value,
    'renderer',
  )
}

export type UseGlobalStateReturnType<T> = [
  value: T,
  setValue: (value: T, source?: string) => void,
]

// DEV: When you switch in live-reload useState to useGlobalState, we lose ref counting. It is advised
//      to restart your build to avoid unknown side effects
function useGlobalState<T>(
  key: string,
  defaultValue: T,
  source?: string,
): UseGlobalStateReturnType<T>
function useGlobalState<T>(
  key: string,
  defaultValue?: undefined,
  source?: string,
): UseGlobalStateReturnType<T | undefined>
function useGlobalState<T>(
  key: string,
  defaultValue?: T,
  source?: string,
): UseGlobalStateReturnType<T | undefined> {
  return useFetchStateFromIPC('globalState', key, defaultValue, source)
}

export { useGlobalState }
