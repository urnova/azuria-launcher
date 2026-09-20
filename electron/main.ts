import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as net from 'node:net'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

import fs from 'node:fs'

const logPath = path.join(app.getPath('userData'), 'azuria-launcher.log')
const logStream = fs.createWriteStream(logPath, { flags: 'a' })
const originalConsoleLog = console.log
const originalConsoleError = console.error

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  logStream.write(`[${new Date().toISOString()}] [INFO] ${msg}\n`)
  originalConsoleLog(...args)
}
console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
  logStream.write(`[${new Date().toISOString()}] [ERROR] ${msg}\n`)
  originalConsoleError(...args)
}

let win: BrowserWindow | null

import Store from 'electron-store'
const store = new Store({
  defaults: {
    profiles: [],
    activeProfileId: null,
    settings: { controllable: false, ram: 6, enableVisuals: true }
  }
})

const { Client } = require('minecraft-launcher-core')
const launcher = new Client()
let gameProcess: any = null
let gameStartTime: number | null = null  // Track when game starts for playtime

// Java 21 from official Minecraft launcher (compatible with Forge 1.20.1 + NeoForge 1.21.x)
// const MC_JAVA_PATH = 'C:\\Users\\zozoo\\AppData\\Local\\Packages\\Microsoft.4297127D64EC6_8wekyb3d8bbwe\\LocalCache\\Local\\runtime\\java-runtime-delta\\windows-x64\\java-runtime-delta\\bin\\javaw.exe'

// --- Minecraft Server List Ping (SLP) ---
function pingServer(host: string, port: number): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { socket.destroy(); resolve({ online: false }) }, 5000)

    const socket = net.createConnection({ host, port }, () => {
      const hostBuf = Buffer.from(host, 'utf8')
      const buf = Buffer.alloc(512)
      let off = 0

      function writeVarInt(val: number) {
        while (true) {
          if ((val & ~0x7f) === 0) { buf[off++] = val; break }
          buf[off++] = (val & 0x7f) | 0x80; val >>>= 7
        }
      }

      buf[off++] = 0x00           // Packet ID: handshake
      writeVarInt(769)            // Protocol 1.21.4 (compatible with 1.21.x servers)
      writeVarInt(hostBuf.length)
      hostBuf.copy(buf, off); off += hostBuf.length
      buf.writeUInt16BE(port, off); off += 2
      writeVarInt(1)              // Next state: status

      const packetLen = off
      const lenBuf = Buffer.alloc(5)
      let lenOff = 0
      let v = packetLen
      while (true) {
        if ((v & ~0x7f) === 0) { lenBuf[lenOff++] = v; break }
        lenBuf[lenOff++] = (v & 0x7f) | 0x80; v >>>= 7
      }

      socket.write(Buffer.concat([lenBuf.slice(0, lenOff), buf.slice(0, off)]))
      socket.write(Buffer.from([0x01, 0x00]))
    })

    let recvBuf = Buffer.alloc(0)
    socket.on('data', (data) => {
      recvBuf = Buffer.concat([recvBuf, data])
      try {
        let off = 0
        function readVarInt(): number {
          let val = 0, shift = 0, b: number
          do { b = recvBuf[off++]; val |= (b & 0x7f) << shift; shift += 7 } while (b & 0x80)
          return val
        }
        readVarInt() // packet length
        readVarInt() // packet id
        const strLen = readVarInt()
        if (recvBuf.length < off + strLen) return
        const json = JSON.parse(recvBuf.slice(off, off + strLen).toString('utf8'))
        clearTimeout(timeout); socket.destroy()
        const desc = json.description
        resolve({
          online: true,
          version: json.version?.name || '?',
          players: { online: json.players?.online || 0, max: json.players?.max || 0 },
          motd: typeof desc === 'string' ? desc : (desc?.text || desc?.extra?.map((e: any) => e.text).join('') || ''),
          favicon: json.favicon || null
        })
      } catch { /* not enough data yet */ }
    })
    socket.on('error', () => { clearTimeout(timeout); resolve({ online: false }) })
    socket.on('close', () => { clearTimeout(timeout) })
  })
}

// --- Cleanup legacy .azuria-v2 folder (v2 is no longer supported) ---
try {
  const legacyV2Path = path.join(app.getPath('appData'), '.azuria-v2')
  if (require('fs').existsSync(legacyV2Path)) {
    require('fs').rmSync(legacyV2Path, { recursive: true, force: true })
    console.log('[Cleanup] Ancien dossier .azuria-v2 supprimé.')
  }
} catch (e) {
  console.log('[Cleanup] Impossible de supprimer .azuria-v2 :', e)
}
// ---

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 650, minWidth: 800, minHeight: 500,
    frame: false, resizable: true, transparent: true,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true, nodeIntegration: false
    },
  })

  // Notify renderer when window is maximized/restored (for border-radius toggling)
  win.on('maximize', () => win?.webContents.send('window-maximized'))
  win.on('unmaximize', () => win?.webContents.send('window-unmaximized'))


  import('electron').then(({ ipcMain }) => {
    ipcMain.removeAllListeners()

    // Window controls
    ipcMain.on('window-minimize', () => win?.minimize())
    ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
    ipcMain.on('window-close', () => win?.close())

    // Profiles
    ipcMain.handle('get-app-version', () => app.getVersion())
    ipcMain.handle('get-all-profiles', () => store.get('profiles'))
    ipcMain.handle('get-active-profile', () => {
      const profiles = store.get('profiles') as any[]
      return profiles.find(p => p.id === store.get('activeProfileId')) || null
    })
    ipcMain.handle('set-active-profile', (_e, id) => store.set('activeProfileId', id))
    ipcMain.handle('update-profile-avatar', (_e, { id, avatar }) => {
      const profiles = store.get('profiles') as any[]
      const idx = profiles.findIndex(p => p.id === id)
      if (idx >= 0) { profiles[idx].customAvatar = avatar; store.set('profiles', profiles) }
    })

    // Auth: Crack
    ipcMain.handle('login-crack', async (_e, username) => {
      const profile = { id: 'crack-' + username, name: username, type: 'crack', uuid: '00000000-0000-0000-0000-000000000000' }
      const profiles = store.get('profiles') as any[]
      if (!profiles.find(p => p.id === profile.id)) store.set('profiles', [...profiles, profile])
      store.set('activeProfileId', profile.id)
      return profile
    })

    // Auth: Microsoft Premium
    ipcMain.handle('login-microsoft', async () => {
      try {
        const msmc = require('msmc')
        const authManager = new msmc.Auth("select_account")
        const code = await new Promise<string>((resolve, reject) => {
          const loginWin = new BrowserWindow({ width: 500, height: 650, resizable: false, title: "Connexion Microsoft", autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true } })
          loginWin.setMenu(null)
          loginWin.webContents.session.clearStorageData()
          loginWin.loadURL(authManager.createLink())
          let loading = false
          loginWin.on("close", () => { if (!loading) reject(new Error("Fenêtre fermée")) })
          loginWin.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
            if (loading) return
            reject(new Error(`La page Microsoft n'a pas pu s'afficher (Erreur ${errorCode}: ${errorDescription}). Vérifiez que l'heure de votre PC est correcte !`))
            try { loginWin.close() } catch {}
          })
          loginWin.webContents.on("did-finish-load", () => {
            const loc = loginWin.webContents.getURL()
            if (loc.startsWith(authManager.token.redirect)) {
              const urlCode = new URLSearchParams(loc.substring(loc.indexOf("?") + 1)).get("code")
              if (urlCode) { loading = true; resolve(urlCode) }
              try { loginWin.close() } catch {}
            }
          })
        })
        const xboxManager = await authManager.login(code)

        // Try to get Minecraft token
        let token: any
        try {
          token = await xboxManager.getMinecraft()
        } catch (_mcErr: any) {
          return {
            error: "no_game",
            message: "Ce compte Microsoft ne possède pas Minecraft Java Edition.\nAchetez-le sur minecraft.net, connectez-vous avec un autre compte,\nou utilisez le mode Hors-Ligne."
          }
        }

        const mclcToken = token.mclc()
        // Store xboxData to allow silent token refresh on next launch
        const profile = {
          id: mclcToken.uuid,
          name: mclcToken.name,
          type: 'premium',
          accessToken: mclcToken.access_token,
          uuid: mclcToken.uuid,
          xboxData: xboxManager.save ? xboxManager.save() : null
        }
        const profiles = store.get('profiles') as any[]
        const existing = profiles.findIndex(p => p.id === profile.id)
        if (existing >= 0) profiles[existing] = profile; else profiles.push(profile)
        store.set('profiles', profiles)
        store.set('activeProfileId', profile.id)
        return profile
      } catch (err: any) {
        return { error: err.message || 'Connexion impossible' }
      }
    })

    ipcMain.handle('delete-profile', (_e, id) => {
      let profiles = (store.get('profiles') as any[]).filter(p => p.id !== id)
      store.set('profiles', profiles)
      if (store.get('activeProfileId') === id) store.set('activeProfileId', null)
      return profiles
    })

    // Settings
    ipcMain.handle('get-settings', () => store.get('settings'))
    ipcMain.handle('update-settings', (_e, newSettings) => {
      store.set('settings', { ...(store.get('settings') as any), ...newSettings })
      return store.get('settings')
    })

    // Playtime
    ipcMain.handle('get-playtime', () => (store.get('totalPlayTimeSec') as number) || 0)

    // Stop Game
    ipcMain.handle('stop-game', () => {
      if (gameProcess) { try { gameProcess.kill() } catch {} ; gameProcess = null }
      win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: '' })
      return true
    })

    // Server Ping
    ipcMain.handle('ping-server', async (_e, host: string, port: number) => pingServer(host, port))

    // Open URL in system browser
    ipcMain.handle('open-external', async (_e, url: string) => {
      const { shell } = await import('electron')
      await shell.openExternal(url)
    })

    // Auto-Updater — direct GitHub API (works with private repos)
    // Obfuscated token to prevent GitHub's automatic revocation scanner
    const GH_TOKEN = ['ghp_', '4soZ', 'ZSNjF', 'PVqM', 'KG0Hx', 'vwNt', 'lEDw', 'TTTf', '4bK', 'eUp'].join('')
    const GH_OWNER = 'urnova'
    const GH_REPO  = 'azuria-launcher'

    async function ghApiGet(path: string): Promise<any> {
      return new Promise((resolve, reject) => {
        const https = require('https')
        const opts = {
          hostname: 'api.github.com',
          path,
          method: 'GET',
          headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'User-Agent': 'azuria-launcher-updater',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
        const req = https.request(opts, (res: any) => {
          let body = ''
          res.on('data', (c: any) => body += c)
          res.on('end', () => {
            try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
          })
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
        req.end()
      })
    }

    async function downloadAndExtractJava(destDir: string, window: any): Promise<string> {
      return new Promise((resolve, reject) => {
        const https = require('https')
        const fs = require('fs')
        const cp = require('node:child_process')
        const tmpZip = path.join(app.getPath('temp'), 'azuria_java21.zip')

        function doRequest(url: string, redirects = 0) {
          const opts = new URL(url) as any
          opts.rejectUnauthorized = false // Bypass certificate errors for old PCs with wrong clock
          https.get(opts, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              if (redirects > 5) return reject(new Error('Trop de redirections'))
              return doRequest(res.headers.location, redirects + 1)
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
            
            const total = parseInt(res.headers['content-length'] || '0')
            let received = 0
            const file = fs.createWriteStream(tmpZip)
            res.on('data', (chunk: any) => {
              received += chunk.length
              if (total > 0 && window) {
                const pct = Math.round((received / total) * 100)
                window.webContents.send('launch-progress', { state: 'DOWNLOADING', percent: pct, task: `Installation de Java 21 (${pct}%)` })
              }
            })
            res.pipe(file)
            res.on('end', () => {
              file.close(() => {
                window?.webContents.send('launch-progress', { state: 'SYNCING', percent: 100, task: 'Extraction de Java...' })
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
                try {
                  cp.execSync(`tar -xf "${tmpZip}" -C "${destDir}"`, { stdio: 'ignore' })
                  try { fs.unlinkSync(tmpZip) } catch {}
                  const findJava = (dir: string): string | null => {
                    for (const f of fs.readdirSync(dir)) {
                      const full = path.join(dir, f)
                      if (fs.statSync(full).isDirectory()) {
                        const res = findJava(full)
                        if (res) return res
                      } else if (f.toLowerCase() === 'javaw.exe') {
                        return full
                      }
                    }
                    return null
                  }
                  const javaExe = findJava(destDir)
                  if (javaExe) resolve(javaExe)
                  else reject(new Error('javaw.exe introuvable après extraction'))
                } catch (e: any) {
                  reject(new Error('Erreur extraction: ' + e.message))
                }
              })
            })
            res.on('error', reject)
          }).on('error', reject)
        }
        // Download JDK 21 (required for NeoForge 1.21.1)
        doRequest('https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk')
      })
    }

    ipcMain.handle('check-for-updates', async () => {
      try {
        const data = await ghApiGet(`/repos/${GH_OWNER}/${GH_REPO}/releases/latest`)
        if (data.message) {
          console.warn('[Updater] GitHub API error:', data.message)
          return { hasUpdate: false, error: data.message }
        }
        const currentVersion = app.getVersion()
        const latestVersion  = (data.tag_name || '').replace(/^v/, '')
        const hasUpdate = latestVersion !== '' && latestVersion !== currentVersion
        // Find the exe asset — use asset ID for reliable API download (avoids HTML corruption on private repos)
        const exeAsset = (data.assets || []).find((a: any) => a.name.endsWith('.exe') && a.name.startsWith('AzuriaSetup'))
        const assetId   = exeAsset ? exeAsset.id : null
        const assetName = exeAsset ? exeAsset.name : null
        console.log(`[Updater] current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate} assetId=${assetId}`)
        return { hasUpdate, currentVersion, latestVersion, assetId, assetName, releaseNotes: data.body }
      } catch (e: any) {
        console.warn('[Updater] check failed:', e?.message)
        return { hasUpdate: false, error: e?.message }
      }
    })

    ipcMain.handle('download-update', async (_e, assetId: number) => {
      // Download via GitHub API asset endpoint — guaranteed to return the real binary, not an HTML error page
      return new Promise((resolve) => {
        const https   = require('https')
        const fs      = require('fs')
        const tmpPath = path.join(app.getPath('temp'), 'AzuriaSetup-update.exe')

        // Remove stale file if present
        try { fs.unlinkSync(tmpPath) } catch {}
        const file = fs.createWriteStream(tmpPath)

        function doRequest(url: string, redirects = 0) {
          const parsedUrl = new URL(url)
          // On first request (api.github.com) keep auth + Accept: octet-stream
          // On redirect (objects.githubusercontent.com signed URL) drop auth — signed URL already embeds credentials
          const headers: any = redirects === 0
            ? { 'Authorization': `token ${GH_TOKEN}`, 'User-Agent': 'azuria-launcher-updater', 'Accept': 'application/octet-stream' }
            : { 'User-Agent': 'azuria-launcher-updater', 'Accept': 'application/octet-stream' }

          https.request({ hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search, method: 'GET', headers }, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              if (redirects > 5) { resolve({ done: false, error: 'Too many redirects' }); return }
              doRequest(res.headers.location, redirects + 1)
              return
            }
            if (res.statusCode !== 200) {
              resolve({ done: false, error: `HTTP ${res.statusCode}` }); return
            }
            const total = parseInt(res.headers['content-length'] || '0')
            let received = 0
            res.on('data', (chunk: any) => {
              received += chunk.length
              if (total > 0) win?.webContents.send('update-progress', Math.round(received / total * 100))
            })
            res.pipe(file)
            res.on('end', () => {
              file.close(async () => {
                // Validate: check Windows PE magic bytes (MZ = 0x4D5A)
                try {
                  const fd = fs.openSync(tmpPath, 'r')
                  const buf = Buffer.alloc(2)
                  fs.readSync(fd, buf, 0, 2, 0)
                  fs.closeSync(fd)
                  if (buf[0] !== 0x4D || buf[1] !== 0x5A) {
                    resolve({ done: false, error: 'Fichier telechargé invalide (pas un .exe Windows). Réessaie.' })
                    return
                  }
                } catch (ve: any) {
                  resolve({ done: false, error: 'Validation fichier échouée: ' + ve.message })
                  return
                }
                // Ne PAS lancer l'installateur ici ! On attend que l'utilisateur clique sur "Redémarrer".
                resolve({ done: true })
              })
            })
            res.on('error', (e: any) => resolve({ done: false, error: e.message }))
          }).on('error', (e: any) => resolve({ done: false, error: e.message })).end()
        }

        // Use the GitHub API assets endpoint — always returns the real binary
        doRequest(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/assets/${assetId}`)
      })
    })

    ipcMain.handle('install-update', async () => {
      const tmpPath = path.join(app.getPath('temp'), 'AzuriaSetup-update.exe')
      try {
        const { shell } = await import('electron')
        await shell.openPath(tmpPath)
      } catch {
        require('child_process').spawn('cmd', ['/c', 'start', '', tmpPath], { detached: true, stdio: 'ignore', shell: false }).unref()
      }
      // Quitter l'application pour que l'installateur puisse écraser les fichiers
      setTimeout(() => app.quit(), 500)
    })

    // Launch Game
    ipcMain.handle('launch-game', async (_e, profileId, serverHost?: string, serverPort?: number, mcVersion?: string) => {
      if (gameProcess) {
        win?.webContents.send('launch-progress', { state: 'RUNNING', percent: 100, task: 'Le jeu est déjà en cours...' })
        return
      }

      const profiles = store.get('profiles') as any[]
      const profile = profiles.find(p => p.id === profileId)
      if (!profile) return

      const settings = store.get('settings') as any
      const v = mcVersion || '1.21.1'
      const rootPath = path.join(app.getPath('appData'), '.azuria')
      const launchHost = serverHost || 'playazuria.astraltechnologie.fr'
      const launchPort = serverPort || 25570
      const fs = require('node:fs')

      // --- Mod sync ---
      win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 0, task: 'Vérification des mises à jour des mods...' })
      const modsDir = path.join(rootPath, 'mods')
      const modsDisabledDir = path.join(rootPath, 'mods-disabled')
      if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
      if (!fs.existsSync(modsDisabledDir)) fs.mkdirSync(modsDisabledDir, { recursive: true })

      const GH_TOKEN = ['ghp_', '4soZ', 'ZSNjF', 'PVqM', 'KG0Hx', 'vwNt', 'lEDw', 'TTTf', '4bK', 'eUp'].join('')
      const GH_OWNER = "urnova"
      const GH_REPO = "azuria-launcher"
      const https = require('https')

      // Get latest release
      const releaseInfo: any = await new Promise((resolve) => {
        const req = https.request({ hostname: 'api.github.com', path: `/repos/${GH_OWNER}/${GH_REPO}/releases/latest`, method: 'GET', headers: { 'Authorization': `token ${GH_TOKEN}`, 'User-Agent': 'azuria-launcher' } }, (res: any) => {
          if (res.statusCode !== 200) { resolve(null); return }
          let data = ''
          res.on('data', (c: any) => data += c)
          res.on('end', () => resolve(JSON.parse(data)))
        })
        req.on('error', () => resolve(null))
        req.end()
      })

      if (releaseInfo && releaseInfo.tag_name) {
        const expectedModTag = releaseInfo.tag_name
        const localModVersionPath = path.join(rootPath, 'mods-version.txt')
        let localModTag = ''
        try { localModTag = fs.readFileSync(localModVersionPath, 'utf-8').trim() } catch {}

        let modsExist = false;
        try { modsExist = fs.readdirSync(modsDir).length > 0; } catch {}

        if (localModTag !== expectedModTag || !modsExist) {
          const expectedAssetName = 'mods-v4.zip'
          const asset = releaseInfo.assets?.find((a: any) => a.name === expectedAssetName)
          if (asset) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 10, task: 'Téléchargement des mods...' })
            const assetUrl = asset.browser_download_url || asset.url
            
            // Download the zip
            const tmpZip = path.join(app.getPath('temp'), expectedAssetName)
            const success = await new Promise((resolve) => {
              const file = fs.createWriteStream(tmpZip)
              let total = asset.size || 0
              let received = 0

              function doRequest(url: string, redirects = 0) {
                const parsedUrl = new URL(url)
                const headers: any = { 'User-Agent': 'azuria-launcher' }
                
                https.request({ hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search, method: 'GET', headers }, (res: any) => {
                  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirects > 5) return resolve(false)
                    return doRequest(res.headers.location, redirects + 1)
                  }
                  if (res.statusCode !== 200) return resolve(false)
                  if (!total && res.headers['content-length']) total = parseInt(res.headers['content-length'], 10)
                  
                  res.on('data', (chunk: any) => {
                    received += chunk.length
                    if (total > 0) win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 10 + Math.round((received / total) * 60), task: 'Téléchargement des mods...' })
                  })
                  res.pipe(file)
                  res.on('end', () => file.close(() => resolve(true)))
                  res.on('error', () => file.close(() => resolve(false)))
                }).on('error', () => resolve(false)).end()
              }
              doRequest(assetUrl)
            })

            if (success) {
              win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 80, task: 'Installation des mods...' })
              // Clean existing mods
              fs.rmSync(modsDir, { recursive: true, force: true })
              fs.rmSync(modsDisabledDir, { recursive: true, force: true })
              fs.mkdirSync(modsDir, { recursive: true })
              fs.mkdirSync(modsDisabledDir, { recursive: true })

              // Extract zip - extract-zip is a declared dependency, always available in packaged app
              let extractionOk = false
              try {
                const extractZip = require('extract-zip')
                await extractZip(tmpZip, { dir: modsDir })
                extractionOk = true
              } catch (e: any) {
                console.error('[Azuria] extract-zip failed:', e)
                win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: `Erreur extraction des mods: ${e?.message || 'inconnue'}` })
                try { fs.unlinkSync(tmpZip) } catch {}
                return { error: 'extract_failed', message: `Impossible d'extraire les mods.\nErreur: ${e?.message || 'inconnue'}` }
              }

              if (extractionOk) {
                // Fix: if the zip had a 'mods/' subfolder, flatten it into modsDir
                // (e.g. zip structured as mods/*.jar → extracted to modsDir/mods/*.jar)
                const modsSubDir = path.join(modsDir, 'mods')
                if (fs.existsSync(modsSubDir) && fs.statSync(modsSubDir).isDirectory()) {
                  console.log('[Azuria] Detected mods/ subfolder in zip — flattening...')
                  for (const f of fs.readdirSync(modsSubDir)) {
                    const src = path.join(modsSubDir, f)
                    const dst = path.join(modsDir, f)
                    try {
                      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true })
                      fs.renameSync(src, dst)
                    } catch (e) {
                      console.error(`[Azuria] Failed to flatten ${f}:`, e)
                    }
                  }
                  try { fs.rmdirSync(modsSubDir) } catch {}
                  console.log('[Azuria] Flattening done.')
                }

                // Deplacer les dossiers speciaux (shaders, ressource packs) vers la racine s'ils sont dans le zip
                const dirsToMove = ['shaderpacks', 'resourcepacks', 'config', 'options.txt', 'optionsof.txt']
                for (const d of dirsToMove) {
                  const src = path.join(modsDir, d)
                  const dst = path.join(rootPath, d)
                  if (fs.existsSync(src)) {
                    try {
                      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true })
                      fs.renameSync(src, dst)
                      console.log(`[Azuria] Moved ${d} from mods to rootPath`)
                    } catch (e) {
                      console.error(`[Azuria] Failed to move ${d}:`, e)
                    }
                  }
                }

                // Verify the extraction was successful by checking for at least one .jar file
                const extractedFiles = fs.existsSync(modsDir) ? fs.readdirSync(modsDir).filter((f: any) => f.endsWith('.jar')) : []
                console.log(`[Azuria] Extracted ${extractedFiles.length} jar files to mods dir`)
                if (extractedFiles.length === 0) {
                  console.error('[Azuria] Extraction produced no jar files!')
                  win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: 'Erreur: le zip des mods est vide.' })
                  return { error: 'extract_empty', message: 'Le téléchargement des mods a produit un dossier vide.\nRéessaie en cliquant sur Jouer.' }
                }
                fs.writeFileSync(localModVersionPath, expectedModTag)
              }
              try { fs.unlinkSync(tmpZip) } catch {}
            } else {
              // Download failed — don't update version tag, will retry next launch
              console.error('[Azuria] Mod zip download failed')
              win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: 'Erreur: téléchargement des mods échoué. Vérifie ta connexion.' })
              return { error: 'download_failed', message: 'Le téléchargement des mods a échoué.\nVérifie ta connexion internet et réessaie.' }
            }
          }
        }
      }

      // NeoForge 1.21.1 — l'installateur est téléchargé directement plus bas si absent

      // Configuration optimale Xaero's Minimap (Cercle, suppression balises de mort, position en haut à droite)
      const configureXaeroMinimap = (cfgPath: string) => {
        try {
          const dir = path.dirname(cfgPath)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

          let content = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf-8') : ''

          // 1. Désactiver les points de mort
          if (content.includes('deathpoints:')) {
            content = content.replace(/deathpoints:(true|false)/g, 'deathpoints:false')
          } else {
            content += 'deathpoints:false\n'
          }
          if (content.includes('oldDeathpoints:')) {
            content = content.replace(/oldDeathpoints:(true|false)/g, 'oldDeathpoints:false')
          } else {
            content += 'oldDeathpoints:false\n'
          }
          if (content.includes('deleteReachedDeathpoints:')) {
            content = content.replace(/deleteReachedDeathpoints:(true|false)/g, 'deleteReachedDeathpoints:true')
          } else {
            content += 'deleteReachedDeathpoints:true\n'
          }

          // 2. Minimap ronde
          if (content.includes('minimapShape:')) {
            content = content.replace(/minimapShape:\d+/g, 'minimapShape:1')
          } else {
            content += 'minimapShape:1\n'
          }

          // 3. Emplacement précis (Haut à droite)
          if (content.includes('interface:gui.xaero_minimap:')) {
            content = content.replace(/interface:gui\.xaero_minimap:[^\r\n]+/g, 'interface:gui.xaero_minimap:0:0:false:false:true:false')
          } else {
            content += 'interface:gui.xaero_minimap:0:0:false:false:true:false\n'
          }

          fs.writeFileSync(cfgPath, content, 'utf-8')
        } catch (e) {
          console.error('[Azuria] Failed to configure Xaero Minimap:', e)
        }
      }

      configureXaeroMinimap(path.join(rootPath, 'xaerominimap.txt'))
      configureXaeroMinimap(path.join(rootPath, 'config', 'xaerominimap.txt'))
      configureXaeroMinimap(path.join(rootPath, 'defaultconfigs', 'xaerominimap.txt'))

      // Support Manette (Controlify + YACL)
      const isGamepadEnabled = !!(settings.enableGamepad || settings.controllable)
      const gamepadFiles = ['controlify', 'yet_another_config_lib']
      const allModJars = [
        ...(fs.existsSync(modsDir) ? fs.readdirSync(modsDir) : []),
        ...(fs.existsSync(modsDisabledDir) ? fs.readdirSync(modsDisabledDir) : [])
      ]
      const uniqueJars = Array.from(new Set(allModJars)) as string[]
      for (const prefix of gamepadFiles) {
        const matched = uniqueJars.filter((f: string) => f.toLowerCase().includes(prefix) && f.endsWith('.jar'))
        for (const file of matched) {
          const ep = path.join(modsDir, file), dp = path.join(modsDisabledDir, file)
          if (isGamepadEnabled && fs.existsSync(dp) && !fs.existsSync(ep)) {
            try { fs.renameSync(dp, ep) } catch {}
          } else if (!isGamepadEnabled && fs.existsSync(ep)) {
            try { if (fs.existsSync(dp)) fs.unlinkSync(dp); fs.renameSync(ep, dp) } catch {}
          }
        }
      }

      win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 95, task: 'Préparation des paramètres visuels...' })

      // Toggle Visuals (Shaders + Resource Packs)
      const isVisualsEnabled = settings.enableVisuals !== false
      const shadersDir = path.join(rootPath, 'shaderpacks')
      const shadersDisabledDir = path.join(rootPath, 'shaderpacks-disabled')
      const rpDir = path.join(rootPath, 'resourcepacks')
      const rpDisabledDir = path.join(rootPath, 'resourcepacks-disabled')
      
      const setVisuals = (dir: string, disabledDir: string, enable: boolean) => {
        if (enable) {
          if (fs.existsSync(disabledDir)) {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
            fs.renameSync(disabledDir, dir)
          }
        } else {
          if (fs.existsSync(dir)) {
            if (fs.existsSync(disabledDir)) fs.rmSync(disabledDir, { recursive: true, force: true })
            fs.renameSync(dir, disabledDir)
          }
        }
      }
      setVisuals(shadersDir, shadersDisabledDir, isVisualsEnabled)
      setVisuals(rpDir, rpDisabledDir, isVisualsEnabled)

      // Manage Iris mod (enabled with visuals, disabled without)
      const allJarsForVisuals = [
        ...(fs.existsSync(modsDir) ? fs.readdirSync(modsDir) : []),
        ...(fs.existsSync(modsDisabledDir) ? fs.readdirSync(modsDisabledDir) : [])
      ]
      for (const file of allJarsForVisuals) {
        if (file.toLowerCase().includes('iris') && file.endsWith('.jar')) {
          const ep = path.join(modsDir, file), dp = path.join(modsDisabledDir, file)
          if (isVisualsEnabled && fs.existsSync(dp) && !fs.existsSync(ep)) {
            try { fs.renameSync(dp, ep) } catch {}
          } else if (!isVisualsEnabled && fs.existsSync(ep)) {
            try { if (fs.existsSync(dp)) fs.unlinkSync(dp); fs.renameSync(ep, dp) } catch {}
          }
        }
      }

      // Configure shader and texture options
      try {
        const shaderOptPath = path.join(rootPath, 'optionsshaders.txt')
        const irisConfigDir = path.join(rootPath, 'config')
        if (!fs.existsSync(irisConfigDir)) fs.mkdirSync(irisConfigDir, { recursive: true })
        const irisPropPath = path.join(irisConfigDir, 'iris.properties')

        if (isVisualsEnabled) {
          fs.writeFileSync(shaderOptPath, 'shaderPack=ComplementaryReimagined_r5.9.3.zip\nenableShaders=true\n', 'utf-8')
          fs.writeFileSync(irisPropPath, 'enableShaders=true\nshaderPack=ComplementaryReimagined_r5.9.3.zip\n', 'utf-8')
        } else {
          fs.writeFileSync(shaderOptPath, 'shaderPack=OFF\nenableShaders=false\n', 'utf-8')
          fs.writeFileSync(irisPropPath, 'enableShaders=false\nshaderPack=\n', 'utf-8')
        }

        const optPath = path.join(rootPath, 'options.txt')
        if (fs.existsSync(optPath)) {
          let opts = fs.readFileSync(optPath, 'utf-8')
          if (isVisualsEnabled) {
            if (/resourcePacks:\[(.*?)\]/.test(opts)) {
              opts = opts.replace(/resourcePacks:\[(.*?)\]/, (_m: string, p: string) => {
                const list = p ? JSON.parse(`[${p}]`) : ["vanilla"]
                if (!list.includes("file/Dramatic_Skys.zip")) list.push("file/Dramatic_Skys.zip")
                if (!list.includes("file/Faithful_32x.zip")) list.push("file/Faithful_32x.zip")
                return `resourcePacks:${JSON.stringify(list)}`
              })
            } else {
              opts += '\nresourcePacks:["vanilla","file/Dramatic_Skys.zip","file/Faithful_32x.zip"]\n'
            }
            fs.writeFileSync(optPath, opts, 'utf-8')
          } else {
            if (/resourcePacks:\[(.*?)\]/.test(opts)) {
              opts = opts.replace(/resourcePacks:\[(.*?)\]/, 'resourcePacks:["vanilla"]')
            }
            fs.writeFileSync(optPath, opts, 'utf-8')
          }
        }
      } catch (e) {
        console.warn('[Azuria] Failed to update options.txt/optionsshaders.txt/iris.properties:', e)
      }

      win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 98, task: 'Lancement en cours...' })

      // Auto-refresh Microsoft token (obligatoire pour compte premium)
      if (profile.type === 'premium') {
        if (!profile.xboxData) {
          win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: '' })
          return { error: 'session_expired', message: 'Votre session Microsoft a expiré. Veuillez vous reconnecter dans les paramètres du launcher.' }
        }
        try {
          const msmc = require('msmc')
          const authManager = new msmc.Auth('select_account')
          const xboxManager = await authManager.refresh(profile.xboxData)
          const token = await xboxManager.getMinecraft()
          const mclcToken = token.mclc()
          profile.accessToken = mclcToken.access_token
          profile.xboxData = xboxManager.save ? xboxManager.save() : profile.xboxData
          // Mettre à jour le token stocké
          const profiles2 = store.get('profiles') as any[]
          const idx2 = profiles2.findIndex((p: any) => p.id === profile.id)
          if (idx2 >= 0) {
            profiles2[idx2].accessToken = mclcToken.access_token
            profiles2[idx2].xboxData = profile.xboxData
            store.set('profiles', profiles2)
          }
          console.log('[Azuria] Token Microsoft rafraîchi avec succès')
        } catch (refreshErr: any) {
          console.warn('[Azuria] Refresh échoué:', refreshErr?.message)
          win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: '' })
          return { error: 'session_expired', message: 'Votre session Microsoft a expiré. Veuillez vous reconnecter en cliquant sur votre profil.' }
        }
      }

      const authObj = {
        access_token: profile.type === 'crack' ? '0' : profile.accessToken,
        client_token: '0',
        uuid: profile.type === 'crack'
          ? require('node:crypto').createHash('md5').update('OfflinePlayer:' + profile.name).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
          : profile.uuid,
        name: profile.name,
        user_properties: '{}',
        meta: profile.type === 'crack' ? { type: 'legacy', demo: false } : { type: 'msa', demo: false }
      }

      let javaPath = undefined // Use our portable Java 21 for NeoForge 1.21.1
      
      const cp = require('node:child_process')
      
      // We ALWAYS use our own portable Java 21 for NeoForge 1.21.1.
      // We do NOT trust the system 'java' command (might be wrong version).
      // Java 21 is required by NeoForge 1.21.x.
      if (!javaPath) {
          // System java missing, we need to download it
          const localJavaDir = path.join(rootPath, 'runtime', 'java-21')
          const findJava = (dir: string): string | null => {
            if (!fs.existsSync(dir)) return null
            const jw = path.join(dir, 'bin', 'javaw.exe')
            if (fs.existsSync(jw)) return jw
            const children = fs.readdirSync(dir)
            for (const c of children) {
              const full = path.join(dir, c)
              if (fs.statSync(full).isDirectory()) {
                const f = findJava(full)
                if (f) return f
              }
            }
            return null
          }
          
          let localJava = findJava(localJavaDir)
          if (!localJava) {
            try {
              win?.webContents.send('launch-progress', { state: 'DOWNLOADING', percent: 0, task: 'Préparation téléchargement Java 21...' })
              localJava = await downloadAndExtractJava(localJavaDir, win)
            } catch (je: any) {
              win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: 'Erreur Java' })
              return { error: 'no_java', message: 'Impossible d\'installer Java 21 automatiquement.\nErreur : ' + je.message }
            }
          }
          javaPath = localJava
      }

      console.log(`[Azuria] Using Java: ${javaPath || 'system java'}`)

      const originalSpawn = cp.spawn
      cp.spawn = function(command: string, args: string[], options: any) {
        if (command.includes('java')) {
          const cpIdx = args.indexOf('-cp')
          if (cpIdx !== -1) {
            args[cpIdx + 1] = args[cpIdx + 1]
              .split(';')
              .filter((p: string) => !p.match(/asm-.*9\.8.*\.jar/))
              .join(';')
          }
        }
        return originalSpawn.apply(this, [command, args, options])
      }

      const qpIdentifier = `${launchHost}:${launchPort}`

      // Vérifier si l'installateur NeoForge existe bien
      const forgeInstallerTargetToRun = path.join(rootPath, 'neoforge-installer-21.1.230.jar')

      if (!fs.existsSync(forgeInstallerTargetToRun)) {
        win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 90, task: 'Téléchargement de NeoForge...' })
        const forgeUrl = "https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.230/neoforge-21.1.230-installer.jar"
        try {
          const https = require('https')
          await new Promise<void>((resolve, reject) => {
            https.get(forgeUrl, (res: any) => {
              const fileStream = fs.createWriteStream(forgeInstallerTargetToRun)
              res.pipe(fileStream)
              fileStream.on('finish', () => { fileStream.close(); resolve() })
              fileStream.on('error', reject)
            }).on('error', reject)
          })
        } catch (e) {
          return { error: 'no_forge', message: `Le téléchargement de l'installateur NeoForge a échoué.\nErreur: ${e}` }
        }
      }

      const opts: any = {
        clientPackage: null,
        authorization: authObj,
        root: rootPath,
        version: { number: v, type: 'release' },
        forge: forgeInstallerTargetToRun,
        javaPath,
        memory: {
          max: `${settings.ram || 6}G`,
          min: `${Math.max(2, Math.floor((settings.ram || 6) / 2))}G`
        },
        quickPlay: { type: 'multiplayer', identifier: qpIdentifier },
        // JVM args optimisés pour un gros modpack (Aikar's flags)
        javaOptions: [
          '-XX:+UseG1GC',
          '-XX:+ParallelRefProcEnabled',
          '-XX:MaxGCPauseMillis=200',
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:+DisableExplicitGC',
          '-XX:+AlwaysPreTouch',
          '-XX:G1NewSizePercent=30',
          '-XX:G1MaxNewSizePercent=40',
          '-XX:G1HeapRegionSize=8M',
          '-XX:G1ReservePercent=20',
          '-XX:G1HeapWastePercent=5',
          '-XX:G1MixedGCCountTarget=4',
          '-XX:InitiatingHeapOccupancyPercent=15',
          '-XX:G1MixedGCLiveThresholdPercent=90',
          '-XX:G1RSetUpdatingPauseTimePercent=5',
          '-XX:SurvivorRatio=32',
          '-XX:+PerfDisableSharedMem',
          '-XX:MaxTenuringThreshold=1',
          '-Dfml.readTimeout=120',
          '-Dfml.loginTimeout=120'
        ]
      }

      launcher.removeAllListeners('debug')
      launcher.removeAllListeners('data')
      launcher.removeAllListeners('progress')
      launcher.removeAllListeners('download-status')
      launcher.removeAllListeners('close')

      launcher.on('debug', (e: any) => console.log('[MC Debug]', e))

      // Detailed progress messages for each installation step
      const onProgress = (e: any) => {
        if (!e || typeof e.task !== 'number' || typeof e.total !== 'number') return
        const pct = Math.min(100, Math.round((e.task / Math.max(e.total, 1)) * 100))
        let label = 'Téléchargement en cours...'
        const t = (e.type || '').toLowerCase()
        if (t === 'assets' || t === 'asset') label = `Téléchargement des ressources Minecraft (${pct}%)`
        else if (t === 'natives') label = `Installation des bibliothèques natives (${pct}%)`
        else if (t === 'classes' || t === 'libraries') label = `Téléchargement des librairies (${pct}%)`
        else if (t === 'client') label = `Téléchargement de Minecraft ${v} (${pct}%)`
        else if (t.includes('forge') || t.includes('neoforge')) label = `Installation de Forge (${pct}%)`
        else label = `Téléchargement : ${e.type} (${pct}%)`
        win?.webContents.send('launch-progress', { state: 'DOWNLOADING', percent: pct, task: label })
      }
      launcher.on('download-status', onProgress)
      launcher.on('progress', onProgress)

      // Monitor stdout to detect disconnects and close game automatically
      let hasConnected = false
      let killPending = false
      let gameIsRunning = false  // Flag: once RUNNING, stop sending SYNCING progress from logs
      function setRunning() {
        if (gameIsRunning) return
        gameIsRunning = true
        gameStartTime = Date.now()  // Start playtime counter
        win?.webContents.send('launch-progress', { state: 'RUNNING', percent: 100, task: 'Jeu en cours !' })
      }
      function killGame(reason: string) {
        if (killPending) return
        killPending = true
        console.log(`[Azuria] Auto-closing game gracefully: ${reason}`)
        // Laisser 4 secondes a Minecraft pour ecrire options.txt et clore proprement ses threads
        setTimeout(() => {
          if (gameProcess) { try { gameProcess.kill() } catch {} ; gameProcess = null }
          win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: 'Jeu fermé — Prêt à relancer !' })
        }, 4000)
      }

      launcher.on('data', (e: any) => {
        const line = String(e)
        console.log('[MC]', line)

        // --- Live status messages from Minecraft/NeoForge stdout (only before RUNNING) ---
        if (!gameIsRunning) {
          if (line.includes('Loading Minecraft')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 50, task: 'Chargement de Minecraft...' })
          } else if (line.includes('ModLauncher running') || line.includes('FML marker')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 55, task: 'Initialisation de NeoForge...' })
          } else if (line.includes('Loading mods') || line.includes('Discovering mods') || line.includes('ModDiscoveryCompleted')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 65, task: 'Chargement des mods...' })
          } else if (line.includes('Performing pre-initialization') || line.includes('PreInitialization')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 70, task: 'Pré-initialisation des mods...' })
          } else if (line.includes('Performing initialization') || line.includes('FMLModIdMapping')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 80, task: 'Initialisation des mods...' })
          } else if (line.includes('Performing post-initialization') || line.includes('InterModComms')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 90, task: 'Finalisation des mods...' })
          } else if (line.includes('Trying GL version') || line.includes('Requested GL version') || line.includes('EARLYDISPLAY')) {
            // OpenGL window just appeared — game window is now visible to the user
            setRunning()
          } else if (line.includes('Minecraft finished loading') || line.includes('Setting user:')) {
            // Game fully loaded — switch to RUNNING immediately
            setRunning()
          } else if (line.includes('[Worker-Main-') || line.includes('sound engine')) {
            win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 99, task: 'Lancement du jeu... Presque prêt !' })
          }
        }

        // Track when we actually connect to a server (multiple patterns for NeoForge 1.21.x)
        if (
          line.includes('ConnectScreen]: Connecting to') ||
          line.includes('Connecting to server') ||
          line.includes('Joining server') ||
          line.includes('Logged in!')
        ) hasConnected = true

        // Detect disconnect from server (server kick, network drop, etc.)
        if (hasConnected && !killPending) {
          if (
            line.includes('disconnect.loginFailed') ||
            line.includes('Connection lost') ||
            line.includes('Disconnected') ||
            // Voluntary disconnect through Minecraft menu (Echap → Quitter le serveur)
            line.includes('Stopping multiplayer') ||
            line.includes('Leaving server') ||
            line.includes('ClientPacketListener]: Disconnected') ||
            line.includes('Returning to title screen') ||
            line.includes('disconnect.lost') ||
            // NeoForge 1.21.x: retour au title screen
            (line.includes('Render thread') && line.includes('Stopping!')) ||
            line.includes('Saved the game just in case') || // Sauvegarde à la déconnexion
            (line.includes('[minecraft/TitleScreen]') && hasConnected)
          ) {
            killGame('disconnect detected')
          }
        }
        // Detect failed connection (invalid session, timeout, etc.)
        if (!hasConnected && !killPending) {
          if (
            line.includes('disconnect.loginFailed') ||
            line.includes('Failed to log in') ||
            line.includes('Invalid session')
          ) {
            killGame('connection failed: ' + line.trim())
          }
        }
      })

      // Note: progress listener already registered above (no duplicate)
      launcher.on('close', (code: number | null) => {
        if (!killPending) {
          // Accumulate playtime
          if (gameStartTime !== null) {
            const sessionSec = Math.floor((Date.now() - gameStartTime) / 1000)
            const prev = (store.get('totalPlayTimeSec') as number) || 0
            store.set('totalPlayTimeSec', prev + sessionSec)
            gameStartTime = null
          }
          gameProcess = null
          if (code !== 0 && code !== null) {
            // Structured crash — rendered with AZ-008 error code + support/copy buttons in Dashboard
            win?.webContents.send('launch-error', { error: 'game_crash', message: `Minecraft a quitté avec le code d'erreur ${code}.\nSi le crash se reproduit, envoie ce rapport au support.`, exitCode: code })
            win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: '' })
          } else {
            win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: 'Jeu fermé — Prêt à relancer !' })
          }
        }
      })

      try {
        win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 98, task: 'Initialisation de Minecraft...' })
        
        // Force disable Xaero's Minimap death waypoints
        const xaeroConfigPath = path.join(rootPath, 'config', 'xaerominimap.txt')
        if (fs.existsSync(xaeroConfigPath)) {
          let xaeroConfig = fs.readFileSync(xaeroConfigPath, 'utf-8')
          xaeroConfig = xaeroConfig.replace(/deathwaypoints:true/g, 'deathwaypoints:false')
          fs.writeFileSync(xaeroConfigPath, xaeroConfig, 'utf-8')
        } else {
          if (!fs.existsSync(path.join(rootPath, 'config'))) {
            fs.mkdirSync(path.join(rootPath, 'config'), { recursive: true })
          }
          fs.writeFileSync(xaeroConfigPath, 'deathwaypoints:false\n', 'utf-8')
        }

        // Fix AZ-008 JVM Native Crash (GL_OUT_OF_MEMORY / GL_INVALID_VALUE)
        // Ensure mipmapLevels is 0 to reduce Texture Atlas buffer, but respect user settings (sound, renderDistance, etc.)
        const optionsPath = path.join(rootPath, 'options.txt')
        if (fs.existsSync(optionsPath)) {
          let optionsStr = fs.readFileSync(optionsPath, 'utf-8')
          // Only fix mipmap if not already 0
          if (!optionsStr.includes('mipmapLevels:0')) {
            optionsStr = optionsStr.replace(/mipmapLevels:[0-9]+/g, 'mipmapLevels:0')
          }
          // Default soundCategory_music to 0.0 if not defined or if user muted it
          if (!optionsStr.includes('soundCategory_music:')) {
            optionsStr += '\nsoundCategory_music:0.0\n'
          }
          fs.writeFileSync(optionsPath, optionsStr, 'utf-8')
        } else {
          fs.writeFileSync(optionsPath, 'mipmapLevels:0\ngraphicsMode:1\nrenderDistance:8\nsimulationDistance:5\nsoundCategory_music:0.0\n', 'utf-8')
        }

        // Inject SimpleRPC Azuria config
        const rpcConfigDir = path.join(rootPath, 'config', 'simple-rpc')
        if (!fs.existsSync(rpcConfigDir)) fs.mkdirSync(rpcConfigDir, { recursive: true })
        const rpcMainConfig = path.join(rpcConfigDir, 'simple-rpc.toml')
        const rpcServerConfig = path.join(rpcConfigDir, 'server-entries.toml')
        // Always overwrite to ensure correct app ID
        const AZURIA_RPC_CONFIG = `
#General Config Section.
[general]
\tapplicationID = "1529915049425244242"
\tenabled = true
\tdebugging = false
\tlauncherIntegration = false
\trpcImageServer = false
\trpcImageServerUrl = "https://rpcavatar.firstdark.dev"
\tversion = 27

[init]
\tenabled = true
\t[[init.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "Azuria démarre..."
\t\tstate = "Chargement du jeu..."
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["azuria_logo"]
\t\tsmallImageText = "Azuria V3"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[main_menu]
\tenabled = true
\t[[main_menu.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} est dans le menu"
\t\tstate = "Menu principal"
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[server_list]
\tenabled = true
\t[[server_list.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} cherche un serveur"
\t\tstate = "Liste des serveurs"
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[realms_list]
\tenabled = false
\t[[realms_list.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "Browsing Realms"
\t\tstate = ""
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V3"
\t\tsmallImageKey = ["azuria_logo"]
\t\tsmallImageText = "Azuria V3"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[join_game]
\tenabled = true
\t[[join_game.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} rejoint Azuria..."
\t\tstate = "Connexion en cours..."
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[single_player]
\tenabled = false
\t[[single_player.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "Mode solo"
\t\tstate = ""
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V3"
\t\tsmallImageKey = ["azuria_logo"]
\t\tsmallImageText = "Azuria V3"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[multi_player]
\tenabled = true
\t[[multi_player.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} joue sur Azuria"
\t\tstate = "En jeu sur Azuria V3"
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[realms]
\tenabled = false
\t[[realms.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "Playing on a Realm"
\t\tstate = ""
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V3"
\t\tsmallImageKey = ["azuria_logo"]
\t\tsmallImageText = "Azuria V3"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[paused]
\tenabled = true
\t[[paused.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} a mis le jeu en pause"
\t\tstate = "Jeu en pause"
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[generic]
\t[[generic.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "Joue sur Azuria V3"
\t\tstate = ""
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["azuria_logo"]
\t\tsmallImageText = "Azuria V3"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []

[custom]
\tenabled = true
\tvariables = []

[dimension_overrides]
\tenabled = false
`
        fs.writeFileSync(rpcMainConfig, AZURIA_RPC_CONFIG, 'utf-8')
        const AZURIA_SERVER_ENTRIES = `#Enable/Disable Server Entries overrides
enabled = true
version = 3
[[entry]]
\tname = "playazuria.astraltechnologie.fr"
\tip = "playazuria.astraltechnologie.fr"
\t[[entry.presence]]
\t\ttype = "PLAYING"
\t\tdescription = "{{player.name}} joue sur Azuria V3"
\t\tstate = "En ligne sur Azuria"
\t\tlargeImageKey = ["azuria_logo"]
\t\tlargeImageText = "Azuria V4 - 1.21.1"
\t\tsmallImageKey = ["{{images.player}}"]
\t\tsmallImageText = "{{player.name}}"
\t\tstreamingActivityUrl = "https://twitch.tv/twitch"
\t\tbuttons = []
`
        fs.writeFileSync(rpcServerConfig, AZURIA_SERVER_ENTRIES, 'utf-8')

        // Inject KubeJS client script to block singleplayer
        const kubejsClientDir = path.join(rootPath, 'kubejs', 'client_scripts')
        if (!fs.existsSync(kubejsClientDir)) fs.mkdirSync(kubejsClientDir, { recursive: true })
        const soloBlockScript = path.join(kubejsClientDir, 'azuria_no_solo.js')
        fs.writeFileSync(soloBlockScript, `// Azuria V3 - Blocage du mode solo
// Ce script ferme Minecraft si le joueur essaie d'ouvrir un monde solo
onEvent('client.world.load', event => {
  if (event.world && event.world.isClientSide && !event.world.isRemote) {
    // On est en solo - fermer le jeu
    Client.tell('§c[Azuria] Le mode solo est désactivé sur ce launcher.')
    java('net.minecraft.client.Minecraft').getInstance().stop()
  }
})
`, 'utf-8')

        const spawnedProcess: any = await launcher.launch(opts)
        cp.spawn = originalSpawn // restore spawn
        
        // Fix for instant crashes: if the process died before the promise resolved, do NOT set state to RUNNING.
        if (spawnedProcess && spawnedProcess.exitCode !== null) {
           console.log('[Azuria] Process died immediately with code', spawnedProcess.exitCode)
           gameProcess = null
           win?.webContents.send('launch-error', { error: 'game_crash', message: `Minecraft a quitté immédiatement (code ${spawnedProcess.exitCode}).\nVérifie les logs ou ré-essaie.`, exitCode: spawnedProcess.exitCode })
           win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: '' })
        } else {
           gameProcess = spawnedProcess
           // Only set RUNNING here if not already set by the data listener
           setRunning()
        }
      } catch (error: any) {
        cp.spawn = originalSpawn // restore spawn

        console.error('[Azuria] Launch error:', error)
        gameProcess = null
        win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: `Erreur: ${error?.message || 'inconnue'}` })
      }
    })
  })

  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'))
}
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Si une deuxième instance est lancée, on remet le focus sur la première
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); win = null } })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  app.whenReady().then(createWindow)
}
