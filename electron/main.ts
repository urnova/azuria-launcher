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

let win: BrowserWindow | null

import Store from 'electron-store'
const store = new Store({
  defaults: {
    profiles: [],
    activeProfileId: null,
    settings: { controllable: false, embeddium: true, ram: 4 }
  }
})

const { Client } = require('minecraft-launcher-core')
const launcher = new Client()
let gameProcess: any = null

// Java 21 from official Minecraft launcher (compatible with NeoForge 1.21.1)
const MC_JAVA_PATH = 'C:\\Users\\zozoo\\AppData\\Local\\Packages\\Microsoft.4297127D64EC6_8wekyb3d8bbwe\\LocalCache\\Local\\runtime\\java-runtime-delta\\windows-x64\\java-runtime-delta\\bin\\javaw.exe'

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

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 650, minWidth: 900, minHeight: 550,
    frame: false, resizable: true, transparent: true,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true, nodeIntegration: false
    },
  })

  // Maximize events removed (maximize button disabled)

  import('electron').then(({ ipcMain }) => {
    ipcMain.removeAllListeners()

    // Window controls
    ipcMain.on('window-minimize', () => win?.minimize())
    ipcMain.on('window-maximize', () => win?.isMaximized() ? win.restore() : win?.maximize())
    ipcMain.on('window-close', () => win?.close())

    // Profiles
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
          loginWin.loadURL(authManager.createLink())
          let loading = false
          loginWin.on("close", () => { if (!loading) reject(new Error("FenÃªtre fermÃ©e")) })
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

        // Try to get Minecraft token â€” fails if account doesn't own the game
        let token: any
        try {
          token = await xboxManager.getMinecraft()
        } catch (_mcErr: any) {
          return {
            error: "no_game",
            message: "Ce compte Microsoft ne possÃ¨de pas Minecraft Java Edition.\nAchetez-le sur minecraft.net, connectez-vous avec un autre compte,\nou utilisez l'accÃ¨s Azuria (mode sans compte)."
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

    // Stop Game
    ipcMain.handle('stop-game', () => {
      if (gameProcess) { try { gameProcess.kill() } catch {} ; gameProcess = null }
      win?.webContents.send('launch-progress', { state: 'IDLE', percent: 0, task: '' })
      return true
    })

    // Server Ping
    ipcMain.handle('ping-server', async (_e, host: string, port: number) => pingServer(host, port))

    // Auto-Updater — direct GitHub API (works with private repos)
    const GH_TOKEN = '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'
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
        // Find the exe asset download URL
        const exeAsset = (data.assets || []).find((a: any) => a.name.endsWith('.exe') && a.name.startsWith('AzuriaSetup'))
        const downloadUrl = exeAsset ? exeAsset.browser_download_url : null
        console.log(`[Updater] current=${currentVersion} latest=${latestVersion} hasUpdate=${hasUpdate}`)
        return { hasUpdate, currentVersion, latestVersion, downloadUrl, releaseNotes: data.body }
      } catch (e: any) {
        console.warn('[Updater] check failed:', e?.message)
        return { hasUpdate: false, error: e?.message }
      }
    })

    ipcMain.handle('download-update', async (_e, downloadUrl: string) => {
      // Download the new installer into temp dir and launch it
      return new Promise((resolve) => {
        const https = require('https')
        const tmpPath = path.join(app.getPath('temp'), 'AzuriaSetup-update.exe')
        const file = require('fs').createWriteStream(tmpPath)
        const opts = {
          hostname: 'objects.githubusercontent.com',
          path: new URL(downloadUrl).pathname + new URL(downloadUrl).search,
          method: 'GET',
          headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'User-Agent': 'azuria-launcher-updater',
            'Accept': 'application/octet-stream'
          }
        }

        function doRequest(url: string, redirects = 0) {
          const parsedUrl = new URL(url)
          const reqOpts = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: redirects === 0 ? opts.headers : { 'User-Agent': 'azuria-launcher-updater' }
          }
          https.request(reqOpts, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              if (redirects > 5) { resolve({ done: false, error: 'Too many redirects' }); return }
              doRequest(res.headers.location, redirects + 1)
              return
            }
            const total = parseInt(res.headers['content-length'] || '0')
            let received = 0
            res.on('data', (chunk: any) => {
              received += chunk.length
              if (total > 0) win?.webContents.send('update-progress', Math.round(received / total * 100))
            })
            res.pipe(file)
            res.on('end', () => {
              file.close(() => {
                require('child_process').spawn(tmpPath, [], { detached: true, stdio: 'ignore' }).unref()
                resolve({ done: true })
              })
            })
            res.on('error', (e: any) => resolve({ done: false, error: e.message }))
          }).on('error', (e: any) => resolve({ done: false, error: e.message })).end()
        }

        doRequest(downloadUrl)
      })
    })

    ipcMain.handle('install-update', () => {
      app.quit()
    })

    // Launch Game
    ipcMain.handle('launch-game', async (_e, profileId, serverHost?: string, serverPort?: number, mcVersion?: string) => {
      if (gameProcess) {
        win?.webContents.send('launch-progress', { state: 'RUNNING', percent: 100, task: 'Le jeu est dÃ©jÃ  en cours...' })
        return
      }

      const profiles = store.get('profiles') as any[]
      const profile = profiles.find(p => p.id === profileId)
      if (!profile) return

      const settings = store.get('settings') as any
      const v = mcVersion || '1.21.1'
      const isV2 = v === '1.21.4'
      const rootPath = path.join(app.getPath('appData'), isV2 ? '.azuria-v2' : '.azuria')
      const launchHost = serverHost || 'playazuria.astraltechnologie.fr'
      const launchPort = serverPort || 25565
      const fs = require('node:fs')

      // --- Mod sync ---
      win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 0, task: 'Vérification des mods...' })
      const modsDir = path.join(rootPath, 'mods')
      const modsDisabledDir = path.join(rootPath, 'mods-disabled')
      if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true })
      if (!fs.existsSync(modsDisabledDir)) fs.mkdirSync(modsDisabledDir, { recursive: true })

      const sourceModsDir = isV2 ? 'F:\\code\\azuria\\azuriav3\\mods-client-1.21.4' : 'F:\\code\\azuria\\azuriav3\\mods-client'
      if (fs.existsSync(sourceModsDir)) {
        const sourceFiles = fs.readdirSync(sourceModsDir).filter((f: string) => f.endsWith('.jar') && !f.includes('neoforge-installer'))
        
        // Supprimer les vieux mods qui ne sont plus dans le dossier source
        const destFiles = fs.readdirSync(modsDir).filter((f: string) => f.endsWith('.jar'))
        for (const f of destFiles) {
          if (!sourceFiles.includes(f)) {
            console.log(`[Azuria] Suppression de l'ancien mod: ${f}`)
            try { fs.unlinkSync(path.join(modsDir, f)) } catch (e) {}
          }
        }

        for (let i = 0; i < sourceFiles.length; i++) {
          const file = sourceFiles[i]
          win?.webContents.send('launch-progress', { state: 'SYNCING', percent: Math.round(((i+1)/sourceFiles.length)*80), task: `Sync: ${file}` })
          const srcPath = path.join(sourceModsDir, file)
          const destPath = path.join(modsDir, file)
          const disabledPath = path.join(modsDisabledDir, file)

          // Forcer la mise à jour si la taille ou la date diffère (détecte les nouvelles compilations)
          const srcStat = fs.statSync(srcPath)
          const needsUpdate = (() => {
            if (fs.existsSync(destPath)) {
              const destStat = fs.statSync(destPath)
              return srcStat.size !== destStat.size || srcStat.mtimeMs > destStat.mtimeMs
            }
            if (fs.existsSync(disabledPath)) {
              const disabledStat = fs.statSync(disabledPath)
              return srcStat.size !== disabledStat.size || srcStat.mtimeMs > disabledStat.mtimeMs
            }
            return true // fichier absent, à copier
          })()

          if (needsUpdate) {
            console.log(`[Azuria] Mise à jour mod: ${file}`)
            // Supprimer les deux emplacements possibles avant de recopier
            try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath) } catch {}
            try { if (fs.existsSync(disabledPath)) fs.unlinkSync(disabledPath) } catch {}
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      // Forcer Xaero's Minimap en Cercle par défaut
      const xaeroConfigPath = path.join(rootPath, 'xaerominimap.txt')
      if (!fs.existsSync(xaeroConfigPath)) {
        try { fs.writeFileSync(xaeroConfigPath, 'minimapShape:1\n') } catch(e) {}
      }

      const optionalMods = [
        { file: isV2 ? 'controlify-3.0.0+lts+1.21.4-neoforge.jar' : 'controlify-3.0.0+lts+1.21.1-neoforge.jar', enabled: settings.controllable === true },
        { file: isV2 ? 'yet_another_config_lib_v3-3.8.2+1.21.4-neoforge.jar' : 'yet_another_config_lib_v3-3.8.2+1.21.1-neoforge.jar', enabled: settings.controllable === true },
        { file: isV2 ? 'embeddium-1.0.12-beta.9999+mc1.21.4.jar' : 'embeddium-0.3.31+mc1.21.1.jar', enabled: isV2 ? false : settings.embeddium !== false }
      ]
      for (const { file, enabled } of optionalMods) {
        const ep = path.join(modsDir, file), dp = path.join(modsDisabledDir, file)
        if (enabled && fs.existsSync(dp) && !fs.existsSync(ep)) fs.renameSync(dp, ep)
        else if (!enabled && fs.existsSync(ep)) fs.renameSync(ep, dp)
      }

      win?.webContents.send('launch-progress', { state: 'SYNCING', percent: 95, task: 'Lancement en cours...' })

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

      const javaPath = fs.existsSync(MC_JAVA_PATH) ? MC_JAVA_PATH : undefined
      console.log(`[Azuria] Using Java: ${javaPath || 'system java'}`)

      const cp = require('node:child_process')
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

      const qpIdentifier = launchPort === 25565 ? launchHost : `${launchHost}:${launchPort}`

      // Force copy of the correct NeoForge installer to rootPath
      const forgeInstallerSource = isV2 ? path.join(sourceModsDir, 'neoforge-installer.jar') : null
      const forgeInstallerTarget = path.join(rootPath, 'neoforge-installer.jar')
      if (isV2 && fs.existsSync(forgeInstallerSource) && !fs.existsSync(forgeInstallerTarget)) {
        try { fs.copyFileSync(forgeInstallerSource, forgeInstallerTarget) } catch {}
      }

      const opts: any = {
        clientPackage: null,
        authorization: authObj,
        root: rootPath,
        version: { number: v, type: 'release' },
        forge: forgeInstallerTarget,
        javaPath,
        memory: {
          max: `${settings.ram || 4}G`,
          min: `${Math.max(1, Math.floor((settings.ram || 4) / 2))}G`
        },
        quickPlay: { type: 'multiplayer', identifier: qpIdentifier }
      }

      launcher.removeAllListeners('debug')
      launcher.removeAllListeners('data')
      launcher.removeAllListeners('progress')
      launcher.removeAllListeners('close')

      launcher.on('debug', (e: any) => console.log('[MC Debug]', e))

      // Monitor stdout to detect disconnects and close game automatically
      let hasConnected = false
      let killPending = false
      function killGame(reason: string) {
        if (killPending) return
        killPending = true
        console.log(`[Azuria] Auto-closing game: ${reason}`)
        setTimeout(() => {
          if (gameProcess) { try { gameProcess.kill() } catch {} ; gameProcess = null }
          win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: 'Jeu fermé — Prêt à relancer !' })
        }, 5000)
      }

      launcher.on('data', (e: any) => {
        const line = String(e)
        console.log('[MC]', line)
        // Track when we actually connect to a server
        if (line.includes('ConnectScreen]: Connecting to')) hasConnected = true
        // Detect disconnect from server
        if (hasConnected && !killPending) {
          if (
            line.includes('Client UDP channel inactive') ||
            line.includes('disconnect.loginFailed') ||
            line.includes('Connection lost') ||
            line.includes('Disconnected') ||
            (line.includes('[Netty Client IO') && line.includes('channel inactive'))
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

      launcher.on('progress', (e: any) => {
        win?.webContents.send('launch-progress', { state: 'DOWNLOADING', percent: Math.round((e.task / e.total) * 100), task: `Téléchargement: ${e.type}` })
      })
      launcher.on('close', () => {
        if (!killPending) {
          gameProcess = null
          win?.webContents.send('launch-progress', { state: 'CLOSED', percent: 0, task: 'Jeu fermé — Prêt à relancer !' })
          // Launcher stays open (like official Minecraft launcher)
        }
      })

      try {
        gameProcess = await launcher.launch(opts)
        cp.spawn = originalSpawn // restore spawn
        win?.webContents.send('launch-progress', { state: 'RUNNING', percent: 100, task: 'Jeu en cours !' })
        // Launcher stays visible when game launches (like official Minecraft launcher)
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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); win = null } })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.whenReady().then(createWindow)
