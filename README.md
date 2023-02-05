# Electron Shared State with React

> Share state between Electron renderers and main processes

Sharing state between multiple renderers shouldn't be hard. So we fixed it by adding simple React hooks similar to `useState`.

Example:

```typescript
export function Settings() {
  const [settings, setSettings] = useSettings('test', [])
  const add = () => setSettings([...settings, 'entry'])

  return (
    <div>
      <button onClick={add}>Add</button>
      {settings.map((s, i) => (
        <div key={`entry-${i}`}>{s}</div>
      ))}
    </div>
  )
}
```

### Getting Started

First, install via yarn or npm `npm -i electron-shared-state-react` to your electron application.

#### 1. Initialize the manager in your Electron main process

There are **two** sets of managers:

1. `SettingsManager`

   With this manager you can persist to disk a set of settings. This is great to store application state.

2. `GlobalStateManager`

   With this manager you can syncronize runtime state between the renderer and main processes, but this data will not be persisted.

Ensure that you also dispose these properly at the end of your application lifecycle in your electron `main` process.

```typescript
import {
  GlobalSharedStateManager,
  SettingsManager,
} from 'electron-shared-state-react/dist/main'

app.on('ready', async () => {
  ...
  await SettingsManager.ready()
  GlobalSharedStateManager.ready()
  ...
}

app.on('before-quit', async () => {
  ...
  SettingsManager.quit()
  GlobalSharedStateManager.quit()
  ...
}
```

#### 2. Expose the ipc bridge in your `preload.ts` for all renderers

We need to expose three methods via Electron's content bridge, so we can communicate with our main process.

**`preload.ts` Example**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import {
  Platform,
  StateChannel,
} from 'electron-shared-state-react/dist/renderer/platform'

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
  updatedValue: (\_: any, \_value: T) => void,
): () => void {
  ipcRenderer.addListener(
    `${channel}:updatedValue:${key}`,
    updatedValue
  )
  ipcRenderer.send(`${channel}:watchKey`, key)

  getStateForChannel(channel, key).then((result) => {
    updatedValue(key, result.value as T)
  })

  return () => {
    ipcRenderer.removeListener(
      `${channel}:updatedValue:${key}`,
      updatedValue
    )
    ipcRenderer.send(`${channel}:unwatchKey`, key)
  }
}

const rendererPlatform: Platform = {
  setStateForChannel,
  subscribeToKey,
  getStateForChannel,
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/ban-types
    electronAPI: {
      rendererPlatform: Platform
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  rendererPlatform,
})
```

#### 3. Initialize the platform now on all renderers

In order for our Electron renderer hooks and methods to work we need to first initialize the platform we exposed in the previous step.

Put this code anywhere in your renderer entry point (e.g. `renderer.ts`):

```typescript
import { initializePlatform } from 'electron-shared-state-react/dist/renderer'
initializePlatform(window.electronAPI.rendererPlatform)
```

#### Use it anywhere in your React hooks

You can now use the settings or global state similar to a `useState` hook in your application:

```typescript
import { useGlobalState } from 'electron-shared-state-react/dist/renderer/useGlobalState'

export function NumberIncrementer() {
  const [numberOfTasks, setNumberOfTasks] = useGlobalState('numberOfTasks', 0)
  return (
    <div>
      <button onClick={() => setNumberOfTasks(numberOfTasks + 1)}>
        Add Task
      </button>

      <div>{numberOfTasks} Tasks</div>
    </div>
  )
}
```

#### Use it outside of React

For settings use:

```typescript
import {
  fetchSettings,
  setSetting,
} from 'electron-shared-state-react/dist/renderer/useSettings'

// fetch a setting
fetchSettings<string[]>('test').then((settings) => {
  console.log(settings)
})

// set a setting
await setSetting('test', ['test'])
```

For global state use:

```typescript
import {
  fetchGlobalState,
  setGlobalState,
} from 'electron-shared-state-react/dist/renderer/useGlobalState'

// fetching a global state
fetchGlobalState<string[]>('test').then((test) => {
  console.log(test)
})

// setting a global state
await setGlobalState('test', ['test'])
```
