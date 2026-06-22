import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    
    // Add custom window properties used in React
    contextBridge.exposeInMainWorld('ipcRenderer', {
      on: (channel: string, listener: (...args: any[]) => void) => {
        ipcRenderer.on(channel, listener)
      },
      send: (channel: string, ...args: any[]) => {
        ipcRenderer.send(channel, ...args)
      },
      invoke: (channel: string, ...args: any[]) => {
        return ipcRenderer.invoke(channel, ...args)
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore
  window.ipcRenderer = ipcRenderer
}
