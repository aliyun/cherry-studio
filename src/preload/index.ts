import type { ExtractChunkData } from '@cherrystudio/embedjs-interfaces'
import { electronAPI } from '@electron-toolkit/preload'
import { context, propagation } from '@opentelemetry/api'
import { IpcChannel } from '@shared/IpcChannel'
import { FileType, KnowledgeBaseParams, KnowledgeItem, MCPServer, Shortcut, WebDavConfig } from '@types'
import { contextBridge, ipcRenderer, OpenDialogOptions, shell } from 'electron'
import { CreateDirectoryOptions } from 'webdav'

function tracedInvoke(channel: string, ...args: any[]) {
  console.log(`[渲染进程拦截] 通道: ${channel}`, args)
  const carray = { type: 'trace' }
  propagation.inject(context.active(), carray)
  return ipcRenderer.invoke(channel, ...args, carray)
}

// Custom APIs for renderer
const api = {
  getAppInfo: () => tracedInvoke(IpcChannel.App_Info),
  reload: () => tracedInvoke(IpcChannel.App_Reload),
  setProxy: (proxy: string | undefined) => tracedInvoke(IpcChannel.App_Proxy, proxy),
  checkForUpdate: () => tracedInvoke(IpcChannel.App_CheckForUpdate),
  showUpdateDialog: () => tracedInvoke(IpcChannel.App_ShowUpdateDialog),
  setLanguage: (lang: string) => tracedInvoke(IpcChannel.App_SetLanguage, lang),
  setLaunchOnBoot: (isActive: boolean) => tracedInvoke(IpcChannel.App_SetLaunchOnBoot, isActive),
  setLaunchToTray: (isActive: boolean) => tracedInvoke(IpcChannel.App_SetLaunchToTray, isActive),
  setTray: (isActive: boolean) => tracedInvoke(IpcChannel.App_SetTray, isActive),
  setTrayOnClose: (isActive: boolean) => tracedInvoke(IpcChannel.App_SetTrayOnClose, isActive),
  restartTray: () => tracedInvoke(IpcChannel.App_RestartTray),
  setTheme: (theme: 'light' | 'dark' | 'auto') => tracedInvoke(IpcChannel.App_SetTheme, theme),
  handleZoomFactor: (delta: number, reset: boolean = false) =>
    tracedInvoke(IpcChannel.App_HandleZoomFactor, delta, reset),
  setAutoUpdate: (isActive: boolean) => tracedInvoke(IpcChannel.App_SetAutoUpdate, isActive),
  openWebsite: (url: string) => tracedInvoke(IpcChannel.Open_Website, url),
  getCacheSize: () => tracedInvoke(IpcChannel.App_GetCacheSize),
  clearCache: () => tracedInvoke(IpcChannel.App_ClearCache),
  system: {
    getDeviceType: () => tracedInvoke(IpcChannel.System_GetDeviceType),
    getHostname: () => tracedInvoke(IpcChannel.System_GetHostname)
  },
  devTools: {
    toggle: () => tracedInvoke(IpcChannel.System_ToggleDevTools)
  },
  zip: {
    compress: (text: string) => tracedInvoke(IpcChannel.Zip_Compress, text),
    decompress: (text: Buffer) => tracedInvoke(IpcChannel.Zip_Decompress, text)
  },
  backup: {
    backup: (fileName: string, data: string, destinationPath?: string) =>
      tracedInvoke(IpcChannel.Backup_Backup, fileName, data, destinationPath),
    restore: (backupPath: string) => tracedInvoke(IpcChannel.Backup_Restore, backupPath),
    backupToWebdav: (data: string, webdavConfig: WebDavConfig) =>
      tracedInvoke(IpcChannel.Backup_BackupToWebdav, data, webdavConfig),
    restoreFromWebdav: (webdavConfig: WebDavConfig) => tracedInvoke(IpcChannel.Backup_RestoreFromWebdav, webdavConfig),
    listWebdavFiles: (webdavConfig: WebDavConfig) => tracedInvoke(IpcChannel.Backup_ListWebdavFiles, webdavConfig),
    checkConnection: (webdavConfig: WebDavConfig) => tracedInvoke(IpcChannel.Backup_CheckConnection, webdavConfig),
    createDirectory: (webdavConfig: WebDavConfig, path: string, options?: CreateDirectoryOptions) =>
      tracedInvoke(IpcChannel.Backup_CreateDirectory, webdavConfig, path, options),
    deleteWebdavFile: (fileName: string, webdavConfig: WebDavConfig) =>
      tracedInvoke(IpcChannel.Backup_DeleteWebdavFile, fileName, webdavConfig)
  },
  file: {
    select: (options?: OpenDialogOptions) => tracedInvoke(IpcChannel.File_Select, options),
    upload: (file: FileType) => tracedInvoke(IpcChannel.File_Upload, file),
    delete: (fileId: string) => tracedInvoke(IpcChannel.File_Delete, fileId),
    read: (fileId: string) => tracedInvoke(IpcChannel.File_Read, fileId),
    clear: () => tracedInvoke(IpcChannel.File_Clear),
    get: (filePath: string) => tracedInvoke(IpcChannel.File_Get, filePath),
    create: (fileName: string) => tracedInvoke(IpcChannel.File_Create, fileName),
    write: (filePath: string, data: Uint8Array | string) => tracedInvoke(IpcChannel.File_Write, filePath, data),
    writeWithId: (id: string, content: string) => tracedInvoke(IpcChannel.File_WriteWithId, id, content),
    open: (options?: OpenDialogOptions) => tracedInvoke(IpcChannel.File_Open, options),
    openPath: (path: string) => tracedInvoke(IpcChannel.File_OpenPath, path),
    save: (path: string, content: string | NodeJS.ArrayBufferView, options?: any) =>
      tracedInvoke(IpcChannel.File_Save, path, content, options),
    selectFolder: () => tracedInvoke(IpcChannel.File_SelectFolder),
    saveImage: (name: string, data: string) => tracedInvoke(IpcChannel.File_SaveImage, name, data),
    base64Image: (fileId: string) => tracedInvoke(IpcChannel.File_Base64Image, fileId),
    download: (url: string) => tracedInvoke(IpcChannel.File_Download, url),
    copy: (fileId: string, destPath: string) => tracedInvoke(IpcChannel.File_Copy, fileId, destPath),
    binaryImage: (fileId: string) => tracedInvoke(IpcChannel.File_BinaryImage, fileId),
    base64File: (fileId: string) => tracedInvoke(IpcChannel.File_Base64File, fileId)
  },
  fs: {
    read: (path: string) => tracedInvoke(IpcChannel.Fs_Read, path)
  },
  export: {
    toWord: (markdown: string, fileName: string) => tracedInvoke(IpcChannel.Export_Word, markdown, fileName)
  },
  openPath: (path: string) => tracedInvoke(IpcChannel.Open_Path, path),
  shortcuts: {
    update: (shortcuts: Shortcut[]) => tracedInvoke(IpcChannel.Shortcuts_Update, shortcuts)
  },
  knowledgeBase: {
    create: (base: KnowledgeBaseParams) => tracedInvoke(IpcChannel.KnowledgeBase_Create, base),
    reset: (base: KnowledgeBaseParams) => tracedInvoke(IpcChannel.KnowledgeBase_Reset, base),
    delete: (id: string) => tracedInvoke(IpcChannel.KnowledgeBase_Delete, id),
    add: ({
      base,
      item,
      forceReload = false
    }: {
      base: KnowledgeBaseParams
      item: KnowledgeItem
      forceReload?: boolean
    }) => tracedInvoke(IpcChannel.KnowledgeBase_Add, { base, item, forceReload }),
    remove: ({ uniqueId, uniqueIds, base }: { uniqueId: string; uniqueIds: string[]; base: KnowledgeBaseParams }) =>
      tracedInvoke(IpcChannel.KnowledgeBase_Remove, { uniqueId, uniqueIds, base }),
    search: ({ search, base }: { search: string; base: KnowledgeBaseParams }) =>
      tracedInvoke(IpcChannel.KnowledgeBase_Search, { search, base }),
    rerank: ({ search, base, results }: { search: string; base: KnowledgeBaseParams; results: ExtractChunkData[] }) =>
      tracedInvoke(IpcChannel.KnowledgeBase_Rerank, { search, base, results })
  },
  window: {
    setMinimumSize: (width: number, height: number) => tracedInvoke(IpcChannel.Windows_SetMinimumSize, width, height),
    resetMinimumSize: () => tracedInvoke(IpcChannel.Windows_ResetMinimumSize)
  },
  gemini: {
    uploadFile: (file: FileType, apiKey: string) => tracedInvoke(IpcChannel.Gemini_UploadFile, file, apiKey),
    base64File: (file: FileType) => tracedInvoke(IpcChannel.Gemini_Base64File, file),
    retrieveFile: (file: FileType, apiKey: string) => tracedInvoke(IpcChannel.Gemini_RetrieveFile, file, apiKey),
    listFiles: (apiKey: string) => tracedInvoke(IpcChannel.Gemini_ListFiles, apiKey),
    deleteFile: (fileId: string, apiKey: string) => tracedInvoke(IpcChannel.Gemini_DeleteFile, fileId, apiKey)
  },
  config: {
    set: (key: string, value: any) => tracedInvoke(IpcChannel.Config_Set, key, value),
    get: (key: string) => tracedInvoke(IpcChannel.Config_Get, key)
  },
  miniWindow: {
    show: () => tracedInvoke(IpcChannel.MiniWindow_Show),
    hide: () => tracedInvoke(IpcChannel.MiniWindow_Hide),
    close: () => tracedInvoke(IpcChannel.MiniWindow_Close),
    toggle: () => tracedInvoke(IpcChannel.MiniWindow_Toggle),
    setPin: (isPinned: boolean) => tracedInvoke(IpcChannel.MiniWindow_SetPin, isPinned)
  },
  aes: {
    encrypt: (text: string, secretKey: string, iv: string) => tracedInvoke(IpcChannel.Aes_Encrypt, text, secretKey, iv),
    decrypt: (encryptedData: string, iv: string, secretKey: string) =>
      tracedInvoke(IpcChannel.Aes_Decrypt, encryptedData, iv, secretKey)
  },
  mcp: {
    removeServer: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_RemoveServer, server),
    restartServer: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_RestartServer, server),
    stopServer: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_StopServer, server),
    listTools: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_ListTools, server),
    callTool: ({ server, name, args }: { server: MCPServer; name: string; args: any }) =>
      tracedInvoke(IpcChannel.Mcp_CallTool, { server, name, args }),
    listPrompts: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_ListPrompts, server),
    getPrompt: ({ server, name, args }: { server: MCPServer; name: string; args?: Record<string, any> }) =>
      tracedInvoke(IpcChannel.Mcp_GetPrompt, { server, name, args }),
    listResources: (server: MCPServer) => tracedInvoke(IpcChannel.Mcp_ListResources, server),
    getResource: ({ server, uri }: { server: MCPServer; uri: string }) =>
      tracedInvoke(IpcChannel.Mcp_GetResource, { server, uri }),
    getInstallInfo: () => tracedInvoke(IpcChannel.Mcp_GetInstallInfo)
  },
  shell: {
    openExternal: (url: string, options?: Electron.OpenExternalOptions) => shell.openExternal(url, options)
  },
  copilot: {
    getAuthMessage: (headers?: Record<string, string>) => tracedInvoke(IpcChannel.Copilot_GetAuthMessage, headers),
    getCopilotToken: (device_code: string, headers?: Record<string, string>) =>
      tracedInvoke(IpcChannel.Copilot_GetCopilotToken, device_code, headers),
    saveCopilotToken: (access_token: string) => tracedInvoke(IpcChannel.Copilot_SaveCopilotToken, access_token),
    getToken: (headers?: Record<string, string>) => tracedInvoke(IpcChannel.Copilot_GetToken, headers),
    logout: () => tracedInvoke(IpcChannel.Copilot_Logout),
    getUser: (token: string) => tracedInvoke(IpcChannel.Copilot_GetUser, token)
  },
  // Binary related APIs
  isBinaryExist: (name: string) => tracedInvoke(IpcChannel.App_IsBinaryExist, name),
  getBinaryPath: (name: string) => tracedInvoke(IpcChannel.App_GetBinaryPath, name),
  installUVBinary: () => tracedInvoke(IpcChannel.App_InstallUvBinary),
  installBunBinary: () => tracedInvoke(IpcChannel.App_InstallBunBinary),
  protocol: {
    onReceiveData: (callback: (data: { url: string; params: any }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { url: string; params: any }) => {
        callback(data)
      }
      ipcRenderer.on('protocol-data', listener)
      return () => {
        ipcRenderer.off('protocol-data', listener)
      }
    }
  },
  nutstore: {
    getSSOUrl: () => tracedInvoke(IpcChannel.Nutstore_GetSsoUrl),
    decryptToken: (token: string) => tracedInvoke(IpcChannel.Nutstore_DecryptToken, token),
    getDirectoryContents: (token: string, path: string) =>
      tracedInvoke(IpcChannel.Nutstore_GetDirectoryContents, token, path)
  },
  searchService: {
    openSearchWindow: (uid: string) => tracedInvoke(IpcChannel.SearchWindow_Open, uid),
    closeSearchWindow: (uid: string) => tracedInvoke(IpcChannel.SearchWindow_Close, uid),
    openUrlInSearchWindow: (uid: string, url: string) => tracedInvoke(IpcChannel.SearchWindow_OpenUrl, uid, url)
  },
  webview: {
    setOpenLinkExternal: (webviewId: number, isExternal: boolean) =>
      tracedInvoke(IpcChannel.Webview_SetOpenLinkExternal, webviewId, isExternal)
  },
  storeSync: {
    subscribe: () => tracedInvoke(IpcChannel.StoreSync_Subscribe),
    unsubscribe: () => tracedInvoke(IpcChannel.StoreSync_Unsubscribe),
    onUpdate: (action: any) => tracedInvoke(IpcChannel.StoreSync_OnUpdate, action)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('obsidian', {
      getVaults: () => tracedInvoke(IpcChannel.Obsidian_GetVaults),
      getFolders: (vaultName: string) => tracedInvoke(IpcChannel.Obsidian_GetFiles, vaultName),
      getFiles: (vaultName: string) => tracedInvoke(IpcChannel.Obsidian_GetFiles, vaultName)
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type WindowApiType = typeof api
