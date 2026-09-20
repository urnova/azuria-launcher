import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const CLIENT_ID = '1529915049425244242'
const LAUNCHER_START_TIME = Math.floor(Date.now() / 1000)

interface ActivityAssets {
  large_image?: string
  large_text?: string
  small_image?: string
  small_text?: string
}

interface ActivityButton {
  label: string
  url: string
}

interface DiscordActivity {
  details?: string
  state?: string
  timestamps?: { start?: number; end?: number }
  assets?: ActivityAssets
  buttons?: ActivityButton[]
}

class DiscordRpcClient {
  private socket: net.Socket | null = null
  private connected = false
  private currentActivity: DiscordActivity | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private isSuspendedForGame = false

  constructor() {
    this.connect()
  }

  private getPipePath(id: number): string {
    if (os.platform() === 'win32') {
      return `\\\\?\\pipe\\discord-ipc-${id}`
    }
    const envDir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'
    return path.join(envDir, `discord-ipc-${id}`)
  }

  private connect(pipeIndex = 0) {
    if (this.isSuspendedForGame) return
    if (pipeIndex > 9) {
      // Retry in 15 seconds if Discord was not found
      this.scheduleReconnect()
      return
    }

    const pipePath = this.getPipePath(pipeIndex)

    try {
      const sock = net.createConnection(pipePath, () => {
        this.socket = sock
        this.sendHandshake()
      })

      sock.on('data', (data) => {
        try {
          if (data.length >= 8) {
            const op = data.readInt32LE(0)
            const len = data.readInt32LE(4)
            const payload = JSON.parse(data.subarray(8, 8 + len).toString('utf-8'))
            if (op === 0 || payload.cmd === 'DISPATCH' || payload.evt === 'READY') {
              this.connected = true
              if (this.currentActivity && !this.isSuspendedForGame) {
                this.sendSetActivity(this.currentActivity)
              }
            }
          }
        } catch {}
      })

      sock.on('error', () => {
        sock.destroy()
        this.connect(pipeIndex + 1)
      })

      sock.on('close', () => {
        this.connected = false
        this.socket = null
        if (!this.isSuspendedForGame) {
          this.scheduleReconnect()
        }
      })
    } catch {
      this.connect(pipeIndex + 1)
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.connect(0)
    }, 15000)
  }

  private sendHandshake() {
    if (!this.socket) return
    const payload = Buffer.from(JSON.stringify({ v: 1, client_id: CLIENT_ID }))
    const header = Buffer.alloc(8)
    header.writeInt32LE(0, 0) // Opcode 0 = Handshake
    header.writeInt32LE(payload.length, 4)
    this.socket.write(Buffer.concat([header, payload]))
  }

  private sendSetActivity(activity: DiscordActivity | null) {
    if (!this.socket || !this.connected) return

    const packet = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity || null,
      },
      nonce: `${Date.now()}-${Math.random()}`,
    }

    const payload = Buffer.from(JSON.stringify(packet))
    const header = Buffer.alloc(8)
    header.writeInt32LE(1, 0) // Opcode 1 = Frame
    header.writeInt32LE(payload.length, 4)
    this.socket.write(Buffer.concat([header, payload]))
  }

  public setActivity(activity: DiscordActivity) {
    this.currentActivity = activity
    if (this.connected && !this.isSuspendedForGame) {
      this.sendSetActivity(activity)
    }
  }

  public setLauncherDefault(username?: string) {
    this.isSuspendedForGame = false
    this.setActivity({
      details: 'Se trouve dans le launcher',
      state: username ? `Profil : ${username}` : 'Prêt à explorer Azuria V4',
      timestamps: { start: LAUNCHER_START_TIME },
      assets: {
        large_image: 'azuria_logo',
        large_text: 'Azuria Launcher V4',
      },
      buttons: [
        { label: 'Rejoindre le Discord', url: 'https://discord.gg/azuria' },
        { label: 'Site Web', url: 'https://azuria.astraltechnologie.fr' },
      ],
    })
  }

  public setLaunching(task: string, percent?: number) {
    if (this.isSuspendedForGame) return
    const stateText = percent !== undefined && percent > 0 ? `${task} (${percent}%)` : task
    this.setActivity({
      details: 'Lancement du jeu...',
      state: stateText,
      timestamps: { start: LAUNCHER_START_TIME },
      assets: {
        large_image: 'azuria_logo',
        large_text: 'Azuria Launcher V4',
      },
      buttons: [
        { label: 'Rejoindre le Discord', url: 'https://discord.gg/azuria' },
        { label: 'Site Web', url: 'https://azuria.astraltechnologie.fr' },
      ],
    })
  }

  /**
   * Suspend launcher RPC so in-game SimpleRPC can take over Discord
   */
  public suspendForGame() {
    this.isSuspendedForGame = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.socket) {
      try {
        this.sendSetActivity(null)
        this.socket.destroy()
      } catch {}
      this.socket = null
      this.connected = false
    }
  }

  /**
   * Restore launcher RPC when Minecraft game exits
   */
  public restoreAfterGame(username?: string) {
    this.isSuspendedForGame = false
    this.setLauncherDefault(username)
    this.connect(0)
  }
}

export const discordRpc = new DiscordRpcClient()
