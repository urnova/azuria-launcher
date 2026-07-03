import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, LogOut, ChevronDown, Gamepad2, CheckCircle2, Circle, AlertTriangle, Server, RefreshCw, StopCircle, Zap, HelpCircle, Send, Copy } from 'lucide-react'
import logo from '../assets/logo.png'
import { SkinViewer, IdleAnimation, WalkingAnimation } from 'skinview3d'
import UpdateModal from './UpdateModal'

const SERVERS = [
  { id: 'v2', category: 'V2 ACTUELLE', name: 'Azuria V2', host: 'game2.northhost.fr', port: 26130, displayHost: 'playazuria.astraltechnologie.fr', desc: 'Serveur actuel (1.21.4)', mcVersion: '1.21.4', statusOverride: null as string | null },
  { id: 'v3test', category: 'V3 EARLY ACCESS', name: 'Azuria V3 — Serveur de test', host: '91.197.6.19', port: 25854, displayHost: '91.197.6.19:25854', desc: '⚠️ Serveur de test — attention', mcVersion: '1.20.1', statusOverride: null as string | null },
  { id: 'main', category: 'V3 EARLY ACCESS', name: 'Azuria V3', host: 'game2.northhost.fr', port: 26130, displayHost: 'playazuria.astraltechnologie.fr', desc: 'Serveur principal V3', mcVersion: '1.20.1', statusOverride: 'INDISPONIBLE' as string | null },
]

const SUPPORT_URL = 'https://azuria.astraltechnologie.fr/support'

// Error code mapping
const ERROR_CODES: Record<string, { code: string; label: string }> = {
  session_expired: { code: 'AZ-001', label: 'Session Microsoft expirée' },
  no_java:         { code: 'AZ-002', label: 'Java 21 introuvable' },
  no_game:         { code: 'AZ-003', label: 'Minecraft non possédé' },
  no_forge:        { code: 'AZ-004', label: 'Forge introuvable' },
  download_failed: { code: 'AZ-005', label: 'Téléchargement échoué' },
  extract_failed:  { code: 'AZ-006', label: 'Extraction des mods échouée' },
  extract_empty:   { code: 'AZ-007', label: 'Archive des mods vide' },
}

function getErrorInfo(errorKey?: string) {
  if (!errorKey) return { code: 'AZ-999', label: 'Erreur inconnue' }
  return ERROR_CODES[errorKey] || { code: 'AZ-999', label: 'Erreur inconnue' }
}

function openSupport(errorCode?: string, errorMsg?: string) {
  let url = SUPPORT_URL
  if (errorCode) {
    const params = new URLSearchParams({ code: errorCode })
    if (errorMsg) params.set('msg', errorMsg.substring(0, 300))
    url += '?' + params.toString()
  }
  window.ipcRenderer.invoke('open-external', url)
}

type Tab = 'home' | 'settings'
type GameState = 'IDLE' | 'SYNCING' | 'DOWNLOADING' | 'RUNNING' | 'CLOSED'

interface ServerStatus { online: boolean; players?: { online: number; max: number }; motd?: string; favicon?: string; version?: string; ping?: number }

const S = {
  bg: '#0a0a0f', surface: '#111118', surface2: '#16161f', surface3: '#1c1c28',
  border: '#1e1e2e', border2: '#2a2a3d',
  accent: '#4f8ef7', accent2: '#00d4ff', epic: '#aa44ff',
  green: '#44cc66', red: '#ff4444', orange: '#ff8800',
  text: '#e8e8f0', text2: '#9999bb', text3: '#5a5a7a',
}

export default function Dashboard({ profile, onLogout }: { profile: any; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [selectedServer, setSelectedServer] = useState('v3test')
  const [showAccounts, setShowAccounts] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [controllable, setControllable] = useState(false)
  const [ram, setRam] = useState(4)
  const [progress, setProgress] = useState({ state: 'IDLE' as GameState, percent: 0, task: '' })
  const [lastError, setLastError] = useState<{ key: string; code: string; label: string; message: string } | null>(null)
  const [profiles, setProfiles] = useState<any[]>([])
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const pingAllServers = useCallback(async () => {
    const results: Record<string, ServerStatus> = {}
    await Promise.all(SERVERS.map(async (srv) => {
      const t0 = Date.now()
      try {
        if (srv.statusOverride) {
          results[srv.id] = { online: false }
          return
        }
        const res = await window.ipcRenderer.invoke('ping-server', srv.host, srv.port)
        results[srv.id] = { ...res, ping: Date.now() - t0 }
      } catch {
        results[srv.id] = { online: false }
      }
    }))
    setServerStatuses(results)
  }, [])

  useEffect(() => {
    window.ipcRenderer.on('launch-progress', (_e: any, d: any) => setProgress(d))
    window.ipcRenderer.invoke('get-settings').then((s: any) => {
      if (s) { setControllable(s.controllable ?? false); setRam(s.ram ?? 4) }
    })
    window.ipcRenderer.invoke('get-all-profiles').then((ps: any) => {
      if (ps) setProfiles(ps.filter((p: any) => p.id !== profile.id))
    })
    pingAllServers()
    const interval = setInterval(pingAllServers, 30000)
    // Check for updates 3s after launch
    const updateTimer = setTimeout(() => setShowUpdateModal(true), 3000)
    return () => { clearInterval(interval); clearTimeout(updateTimer) }
  }, [profile.id, pingAllServers])

  useEffect(() => {
    if (!canvasRef.current) return
    const viewer = new SkinViewer({
      canvas: canvasRef.current, width: 170, height: 210,
      skin: profile.customAvatar || `https://minotar.net/skin/${profile.name}`,
    })
    viewer.animation = new IdleAnimation()
    viewer.camera.position.set(0, 8, 38)
    viewer.controls.enableZoom = false
    const w = () => (viewer.animation = new WalkingAnimation())
    const i = () => (viewer.animation = new IdleAnimation())
    canvasRef.current.addEventListener('mouseenter', w)
    canvasRef.current.addEventListener('mouseleave', i)
    return () => { viewer.dispose() }
  }, [profile])

  const server = SERVERS.find(s => s.id === selectedServer)!
  const status = serverStatuses[selectedServer]
  const isRunning = progress.state === 'RUNNING'
  const isClosed = progress.state === 'CLOSED'
  const isBusy = !['IDLE', 'RUNNING', 'CLOSED'].includes(progress.state)

  const handleLaunch = async () => {
    setLastError(null)
    setProgress({ state: 'SYNCING', percent: 0, task: 'Initialisation...' })
    const res = await window.ipcRenderer.invoke('launch-game', profile.id, server.host, server.port, server.mcVersion)
    if (res && res.error) {
      const errInfo = getErrorInfo(res.error)
      setLastError({ key: res.error, code: errInfo.code, label: errInfo.label, message: res.message || '' })
      setProgress({ state: 'CLOSED', percent: 0, task: res.message || 'Erreur de connexion' })
      if (res.error === 'session_expired') {
        alert(res.message + "\n\nLa fenêtre de connexion va s'ouvrir automatiquement.")
        try {
          const newProfile = await window.ipcRenderer.invoke('login-microsoft')
          if (newProfile && !newProfile.error) {
            setLastError(null)
            setProgress({ state: 'SYNCING', percent: 0, task: 'Connexion réussie, lancement...' })
            await window.ipcRenderer.invoke('launch-game', newProfile.id, server.host, server.port)
            window.location.reload()
          } else if (newProfile?.error) {
            alert(newProfile.message || newProfile.error)
          }
        } catch (e) {
          console.error(e)
        }
      } else if (res.error === 'no_game') {
        alert(res.message)
      } else if (res.error === 'no_java') {
        alert(res.message)
      }
    }
  }

  const handleStop = () => window.ipcRenderer.invoke('stop-game')

  const toggleSetting = async (key: 'controllable') => {
    const val = !controllable
    setControllable(val)
    await window.ipcRenderer.invoke('update-settings', { [key]: val })
  }

  const updateRam = async (v: number) => { setRam(v); await window.ipcRenderer.invoke('update-settings', { ram: v }) }

  const switchProfile = async (p: any) => {
    await window.ipcRenderer.invoke('set-active-profile', p.id)
    window.location.reload()
  }

  const getPingColor = (ping?: number) => {
    if (!ping) return S.text3
    if (ping < 80) return S.green
    if (ping < 150) return '#ffcc00'
    return S.orange
  }

  const getPingBars = (ping?: number) => {
    if (!ping) return 0
    if (ping < 80) return 5
    if (ping < 120) return 4
    if (ping < 150) return 3
    if (ping < 200) return 2
    return 1
  }

  return (
    <div className="w-full h-full flex relative" style={{ background: S.bg }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 30% 0%, rgba(79,142,247,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(170,68,255,0.06) 0%, transparent 60%)' }} />

      {/* UPDATE MODAL */}
      {showUpdateModal && <UpdateModal onClose={() => setShowUpdateModal(false)} />}

      {/* SIDEBAR */}
      <div className="w-64 shrink-0 flex flex-col relative z-20" style={{ background: 'rgba(17,17,24,0.95)', borderRight: `1px solid ${S.border}`, backdropFilter: 'blur(20px)', minHeight: 0 }}>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
          <div className="flex flex-col items-center pt-4 pb-3 px-4 flex-shrink-0" style={{ borderBottom: `1px solid ${S.border}` }}>
            <div className="relative group mb-3 flex-shrink-0">
              <canvas ref={canvasRef} className="outline-none" style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.8))', maxHeight: 220, display: 'block' }} />
            </div>
            <div className="w-full relative mt-2">
              <button onClick={() => setShowAccounts(!showAccounts)} className="flex items-center gap-1.5 px-2 py-1 transition-colors rounded-md hover:bg-white/5 w-full justify-center">
                <span style={{ fontWeight: 800, fontSize: 16, color: S.text }}>{profile.name}</span>
                <ChevronDown size={15} style={{ color: S.text3, transform: showAccounts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <div className="flex justify-center">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: profile.type === 'crack' ? S.surface3 : 'rgba(170,68,255,0.15)', color: profile.type === 'crack' ? S.text3 : S.epic, border: `1px solid ${profile.type === 'crack' ? S.border2 : 'rgba(170,68,255,0.3)'}`, display: 'inline-block' }}>
                  {profile.type === 'crack' ? 'Craqué' : '★ Premium'}
                </div>
              </div>
              {showAccounts && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-lg overflow-hidden z-50" style={{ background: S.surface, border: `1px solid ${S.border2}`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {profiles.length > 0 ? profiles.map(p => (
                    <button key={p.id} onClick={() => switchProfile(p)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                      <div className="w-7 h-7 rounded shrink-0" style={{ background: S.surface3 }} />
                      <div><div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{p.name}</div><div style={{ fontSize: 9, color: p.type === 'crack' ? S.text3 : S.epic, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{p.type === 'crack' ? 'Craqué' : 'Premium'}</div></div>
                    </button>
                  )) : <div style={{ padding: '8px 12px', fontSize: 11, color: S.text3, textAlign: 'center' }}>Aucun autre compte</div>}
                  <div style={{ borderTop: `1px solid ${S.border}` }}>
                    <button onClick={onLogout} className="w-full py-2 transition-colors hover:bg-white/5" style={{ fontSize: 11, color: S.accent, fontWeight: 600 }}>+ Ajouter un compte</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-1 p-3 flex-shrink-0">
            {([{ id: 'home' as Tab, icon: '⚔', label: 'Accueil' }, { id: 'settings' as Tab, icon: '⚙', label: 'Paramètres' }]).map(item => (
              <button key={item.id} onClick={() => setTab(item.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: tab === item.id ? 'rgba(79,142,247,0.15)' : 'transparent', color: tab === item.id ? S.accent : S.text2, border: `1px solid ${tab === item.id ? 'rgba(79,142,247,0.3)' : 'transparent'}` }}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
            <button
              onClick={() => openSupport()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ color: S.text2, border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = S.text }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = S.text2 }}
            >
              <HelpCircle size={16} />Support
            </button>
          </nav>
        </div>

        <div className="mt-auto p-3 flex-shrink-0" style={{ borderTop: `1px solid ${S.border}` }}>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-red-500/10" style={{ color: S.red }}>
            <LogOut size={16} />Déconnexion
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {tab === 'home' && (
          <div className="flex-1 flex flex-col items-center p-4 pt-12 overflow-y-auto overflow-x-hidden">
            <img src={logo} alt="Azuria" className="w-28 h-28 object-contain mb-4" style={{ filter: 'drop-shadow(0 0 28px rgba(79,142,247,0.5))', animation: 'float 4s ease-in-out infinite' }} />
            <h1 className="font-black mb-1" style={{ fontSize: 40, letterSpacing: -2, background: 'linear-gradient(135deg, #fff 0%, #4f8ef7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AZURIA</h1>
            <p className="mb-8" style={{ color: S.text2, fontSize: 14 }}>Prêt à rejoindre l'aventure ?</p>

            {/* Server selector with ping */}
            <div className="w-full max-w-md min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3 }}>Choisir le serveur</div>
                <button onClick={pingAllServers} className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-white/5" style={{ fontSize: 10, color: S.text3 }}>
                  <RefreshCw size={10} />Actualiser
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {['V2 ACTUELLE', 'V3 EARLY ACCESS'].map(cat => (
                  <div key={cat} className="flex flex-col gap-2">
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3 }}>{cat}</div>
                    {SERVERS.filter(s => s.category === cat).map(srv => {
                      const st = serverStatuses[srv.id]
                      const isOnline = srv.statusOverride ? false : st?.online === true
                      const bars = getPingBars(st?.ping)
                      return (
                        <button key={srv.id} onClick={() => !isBusy && !isRunning && setSelectedServer(srv.id)}
                          className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all w-full min-w-0 overflow-hidden"
                          style={{ background: selectedServer === srv.id ? 'rgba(79,142,247,0.12)' : S.surface, border: `1px solid ${selectedServer === srv.id ? 'rgba(79,142,247,0.4)' : S.border}`, boxShadow: selectedServer === srv.id ? '0 0 20px rgba(79,142,247,0.15)' : 'none', opacity: isBusy && selectedServer !== srv.id ? 0.5 : 1 }}>
                          
                          {/* Server icon / status dot */}
                          {st?.favicon && !srv.statusOverride ? (
                            <img src={st.favicon} alt="" className="w-10 h-10 rounded" style={{ imageRendering: 'pixelated' }} />
                          ) : (
                            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: S.surface3 }}>
                              <Server size={18} style={{ color: srv.statusOverride ? S.text3 : (isOnline ? S.accent : S.text3) }} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span style={{ fontWeight: 700, fontSize: 14, color: S.text }}>{srv.name}</span>
                              {srv.statusOverride ? (
                                <span style={{ fontSize: 9, color: S.text3, border: `1px solid ${S.border2}`, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{srv.statusOverride}</span>
                              ) : st === undefined ? (
                                <span style={{ fontSize: 9, color: S.text3, border: `1px solid ${S.border2}`, padding: '1px 6px', borderRadius: 4 }}>…</span>
                              ) : isOnline ? (
                                <span style={{ fontSize: 9, color: S.green, border: `1px solid rgba(68,204,102,0.4)`, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>EN LIGNE</span>
                              ) : (
                                <span style={{ fontSize: 9, color: S.red, border: `1px solid rgba(255,68,68,0.4)`, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>HORS LIGNE</span>
                              )}
                            </div>
                            <div className="truncate" style={{ fontSize: 11, color: S.text3, marginBottom: 2 }}>{srv.displayHost}</div>
                            {isOnline && st?.motd && !srv.statusOverride && <div style={{ fontSize: 10, color: S.text2 }} className="truncate">{st.motd.replace(/§[0-9a-fk-or]/gi, '')}</div>}
                            {isOnline && st?.players && !srv.statusOverride && <div style={{ fontSize: 10, color: S.text3 }}>{st.players.online}/{st.players.max} joueurs · {srv.mcVersion}</div>}
                          </div>

                          {/* Ping bars */}
                          {!srv.statusOverride && (
                            <div className="flex items-end gap-0.5 shrink-0">
                              {[1,2,3,4,5].map(b => (
                                <div key={b} style={{ width: 3, height: 4 + b * 2, borderRadius: 1, background: isOnline && bars >= b ? getPingColor(st?.ping) : S.border2, opacity: isOnline && bars >= b ? 1 : 0.3 }} />
                              ))}
                              {isOnline && st?.ping && <span style={{ fontSize: 9, color: getPingColor(st?.ping), marginLeft: 4 }}>{st.ping}ms</span>}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-lg">
              <h2 className="font-bold text-lg mb-1" style={{ color: S.text }}>Paramètres du Lanceur</h2>
              <p className="text-xs mb-6" style={{ color: S.text3 }}>Configuration de l'expérience de jeu</p>
              <div className="flex flex-col gap-3">
                <div className="p-4 rounded-xl" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-sm" style={{ color: S.text }}>Mémoire RAM allouée</div>
                      <div className="text-xs mt-0.5" style={{ color: S.text3 }}>Recommandé : 4G minimum</div>
                    </div>
                    <span className="font-black text-xl" style={{ color: S.accent }}>{ram}G</span>
                  </div>
                  <input type="range" min={2} max={16} step={1} value={ram} onChange={e => updateRam(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: S.accent }} />
                  <div className="flex justify-between text-xs mt-1" style={{ color: S.text3 }}><span>2G</span><span>8G</span><span>16G</span></div>
                </div>
                <button onClick={() => toggleSetting('controllable')} className="p-4 rounded-xl flex items-center gap-4 text-left transition-all" style={{ background: S.surface, border: `1px solid ${controllable ? S.accent : S.border}` }}>
                  <Gamepad2 size={26} style={{ color: controllable ? S.accent : S.text3 }} />
                  <div className="flex-1"><div className="font-bold text-sm" style={{ color: S.text }}>Support Manette (Controlify)</div><div className="text-xs" style={{ color: S.text3 }}>PS4 / Xbox / Switch Pro</div></div>
                  {controllable ? <CheckCircle2 size={20} style={{ color: S.green }} /> : <Circle size={20} style={{ color: S.text3 }} />}
                </button>
                <div className="p-4 rounded-xl flex items-center gap-4" style={{ background: S.surface, border: `1px solid ${S.accent}` }}>
                  <Zap size={26} style={{ color: S.accent }} />
                  <div className="flex-1"><div className="font-bold text-sm" style={{ color: S.text }}>Optimisation FPS (Embeddium + Chloride)</div><div className="text-xs" style={{ color: S.text3 }}>Activé par défaut — améliore drastiquement les performances</div></div>
                  <CheckCircle2 size={20} style={{ color: S.green }} />
                </div>

              </div>
            </div>
          </div>
        )}

        {/* LAUNCH BAR */}
        <div className="shrink-0 flex items-center gap-4 p-4" style={{ background: `linear-gradient(to top, ${S.bg} 0%, transparent 100%)`, borderTop: `1px solid ${S.border}` }}>
          <div className="flex-1 min-w-0">
            {isBusy ? (
              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1.5">
                  <span style={{ color: S.text }}>{progress.task}</span>
                  <span style={{ color: S.accent }}>{Math.round(progress.percent)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: S.surface3 }}>
                  <div className="h-full rounded-full transition-all duration-300 relative" style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${S.accent}, ${S.accent2})` }}>
                    <div className="absolute inset-0 opacity-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', animation: 'shimmer 1.5s infinite' }} />
                  </div>
                </div>
              </div>
            ) : isRunning ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: S.green, boxShadow: `0 0 8px ${S.green}`, animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: S.green }}>EN COURS — {server.name}</span>
              </div>
            ) : isClosed ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {lastError && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', color: S.red, letterSpacing: 1 }}>
                      {lastError.code}
                    </span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: S.text }}>
                    {lastError ? lastError.label : progress.task}
                  </span>
                </div>
                {lastError && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => openSupport(lastError.code, lastError.message)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                      style={{ background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.35)', color: S.accent }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,142,247,0.25)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(79,142,247,0.15)')}
                    >
                      <Send size={11} />Envoyer le rapport
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${lastError.code}: ${lastError.label}\n${lastError.message}`) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`, color: S.text3 }}
                      title="Copier le code d'erreur"
                    >
                      <Copy size={11} />{lastError.code}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: S.text }}>{server.name}</span>
                <span style={{ fontSize: 11, color: S.text3 }}> · {server.displayHost}</span>
                {server.statusOverride ? (
                  <span style={{ fontSize: 10, color: S.text3, marginLeft: 8 }}>● {server.statusOverride}</span>
                ) : status?.online ? (
                  <span style={{ fontSize: 10, color: S.green, marginLeft: 8 }}>● {status.players?.online}/{status.players?.max} joueurs</span>
                ) : status && !status.online ? (
                  <span style={{ fontSize: 10, color: S.red, marginLeft: 8 }}>● Hors ligne</span>
                ) : null}
              </div>
            )}
          </div>

          {isRunning ? (
            <button onClick={handleStop} className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5" style={{ background: S.red, boxShadow: `0 0 24px rgba(255,68,68,0.4)` }}>
              <StopCircle size={18} />FERMER LE JEU
            </button>
          ) : isBusy ? (
            <button className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-base text-white/50 cursor-not-allowed" style={{ background: S.surface3 }}>
              <span className="animate-spin inline-block">⟳</span> EN COURS...
            </button>
          ) : server.statusOverride ? (
            <button disabled className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-base text-white/50 cursor-not-allowed" style={{ background: S.surface3 }}>
              <AlertTriangle size={18} />INDISPONIBLE
            </button>
          ) : status?.online === false ? (
            <button disabled className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-base text-white/50 cursor-not-allowed" style={{ background: S.surface3 }}>
              <AlertTriangle size={18} />SERVEUR HORS LIGNE
            </button>
          ) : isClosed ? (
            <button onClick={handleLaunch} className="group relative flex items-center gap-2 px-10 py-3.5 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${S.green}, #22aa44)`, boxShadow: `0 0 30px rgba(68,204,102,0.4)` }}>
              <RefreshCw size={18} />RELANCER
            </button>
          ) : (
            <button onClick={handleLaunch} className="group relative flex items-center gap-2 px-12 py-3.5 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${S.accent}, #6ba3ff)`, boxShadow: `0 0 30px rgba(79,142,247,0.4)` }}>
              <Play size={18} className="fill-current" />JOUER
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', transform: 'skewX(-12deg)' }} />
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } } @keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } } @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}