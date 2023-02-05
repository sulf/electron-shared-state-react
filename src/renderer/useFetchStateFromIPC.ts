import { useCallback, useEffect, useState } from 'react'
import { StateChannel, platform } from './platform'

// Don't use this hook directly, it's just an abstracted version for `useSettings` and `useGlobalState`
function useFetchStateFromIPC<T>(
  channel: StateChannel,
  key: string,
  defaultValue: T,
  source?: string,
): [value: T, setValue: (value: T) => void]
function useFetchStateFromIPC<T>(
  channel: StateChannel,
  key: string,
  defaultValue?: undefined,
  source?: string,
): [value: T | undefined, setValue: (value: T) => void]
function useFetchStateFromIPC<T>(
  channel: StateChannel,
  key: string,
  defaultValue?: T,
  source?: string,
): [value: T | undefined, setValue: (value: T) => void] {
  const [value, _setValue] = useState(defaultValue)

  useEffect(() => {
    let isSubscribed = true
    platform
      .getStateForChannel<T>(channel, key)
      .then(({ value: _value, hasKey }) => {
        if (!isSubscribed) return
        if (!hasKey) {
          _setValue(defaultValue)
        } else {
          _setValue(_value)
        }
      })
    return () => {
      isSubscribed = false
    }
  }, [channel, key])

  useEffect(() => {
    let isSubscribed = true
    const updatedValue = (_: any, _value: T) => {
      if (isSubscribed) {
        _setValue(typeof _value === 'undefined' ? defaultValue : _value)
      }
    }
    const unsubscribe = platform.subscribeToKey<T>(channel, key, updatedValue)
    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [channel, key, defaultValue])

  const setValue = useCallback(
    (_value?: T, _source?: string) => {
      _setValue((val) => {
        if (val !== _value) {
          platform.setStateForChannel<T>(
            channel,
            key,
            _value,
            _source || source,
          )
        }
        return _value
      })
    },
    [channel, key],
  )

  return [value, setValue]
}

export default useFetchStateFromIPC
