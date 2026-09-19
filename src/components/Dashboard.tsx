import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, LogOut, ChevronDown, CheckCircle2, AlertTriangle, Server, RefreshCw, StopCircle, Send, Copy, Clock, User, Shield, Cpu, Globe, ChevronRight, Gamepad2 } from 'lucide-react'
import logo from '../assets/logo.png'
import astralLogo from '../assets/astral-logo.png'
import heroBg from '../assets/hero-bg.jpg'
import newsBanner from '../assets/news-banner.jpg'
import { SkinViewer, IdleAnimation } from 'skinview3d'
import UpdateModal from './UpdateModal'

const SERVERS = [
  { id: 'main', category: 'SERVEUR PRINCIPAL', name: 'Azuria V4 (1.21.1)', host: 'game03.octoheberg.fr', port: 25570, displayHost: 'playazuria.astraltechnologie.fr', desc: 'Serveur principal V4', mcVersion: '1.21.1', statusOverride: null as string | null }
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
  game_crash:      { code: 'AZ-008', label: 'Crash du jeu Minecraft' },
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

type Tab = 'home' | 'map' | 'settings'
type GameState = 'IDLE' | 'SYNCING' | 'DOWNLOADING' | 'RUNNING' | 'CLOSED'

interface ServerStatus { online: boolean; players?: { online: number; max: number }; motd?: string; favicon?: string; version?: string; ping?: number }

const S = {
  bg: '#0a0a0f', surface: '#111118', surface2: '#16161f', surface3: '#1c1c28',
  border: '#1e1e2e', border2: '#2a2a3d',
  accent: '#4f8ef7', accent2: '#00d4ff', epic: '#aa44ff',
  green: '#44cc66', red: '#ff4444', orange: '#ff8800',
  text: '#e8e8f0', text2: '#9999bb', text3: '#5a5a7a',
}

export default function Dashboard({ profile, onLogout, onProfileSwitch, initialStatuses }: { profile: any; onLogout: () => void; onProfileSwitch?: (p: any) => void; initialStatuses?: Record<string, any> }) {
  const [tab, setTab] = useState<Tab>('home')
  const [selectedServer, setSelectedServer] = useState('main')
  const [showAccounts, setShowAccounts] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [ram, setRam] = useState(8)
  const [enableVisuals, setEnableVisuals] = useState(true)
  const [enableGamepad, setEnableGamepad] = useState(false)
  const [totalPlaySec, setTotalPlaySec] = useState(0)
  const [progress, setProgress] = useState({ state: 'IDLE' as GameState, percent: 0, task: '' })
  const [lastError, setLastError] = useState<{ key: string; code: string; label: string; message: string } | null>(null)
  const [profiles, setProfiles] = useState<any[]>([])
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>(initialStatuses || {})
  const [appVersion, setAppVersion] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const pingAllServers = useCallback(async () => {
    const results: Record<string, ServerStatus> = { ...serverStatuses }
    await Promise.all(SERVERS.map(async (srv) => {
      const t0 = Date.now()
      try {
        if (srv.statusOverride) {
          results[srv.id] = { online: false }
          return
        }
        // Try IPC ping first
        const res = await window.ipcRenderer.invoke('ping-server', srv.host, srv.port)
        if (res && res.online) {
          results[srv.id] = { ...res, ping: Date.now() - t0 }
        } else {
          // Fallback: use external API
          try {
            const apiRes = await fetch(`https://api.mcsrvstat.us/3/${srv.host}`)
            const apiData = await apiRes.json()
            if (apiData.online) {
              results[srv.id] = {
                online: true,
                players: apiData.players ? { online: apiData.players.online, max: apiData.players.max } : undefined,
                version: apiData.version,
              }
            } else {
              results[srv.id] = { online: false }
            }
          } catch {
            results[srv.id] = { online: false }
          }
        }
      } catch {
        results[srv.id] = { online: false }
      }
    }))
    setServerStatuses(results)
  }, [])

  useEffect(() => {
    window.ipcRenderer.on('launch-progress', (_e: any, d: any) => setProgress(d))
    window.ipcRenderer.on('launch-error', (_e: any, d: any) => {
      if (d && d.error) {
        const errInfo = getErrorInfo(d.error)
        setLastError({ key: d.error, code: errInfo.code, label: errInfo.label, message: d.message || '' })
      }
    })
    window.ipcRenderer.invoke('get-settings').then((s: any) => {
      if (s) { setRam(s.ram ?? 8); setEnableVisuals(s.enableVisuals ?? true); setEnableGamepad(s.enableGamepad ?? s.controllable ?? false) }
    })
    window.ipcRenderer.invoke('get-playtime').then((sec: number) => {
      setTotalPlaySec(sec || 0)
    })
    window.ipcRenderer.invoke('get-app-version').then((v: string) => {
      if (v) setAppVersion(v)
    })
    window.ipcRenderer.invoke('get-all-profiles').then((ps: any) => {
      if (ps) setProfiles(ps.filter((p: any) => p.id !== profile.id))
    })
    
    // Only ping if we don't already have the initial statuses
    if (!initialStatuses || Object.keys(initialStatuses).length === 0) {
      pingAllServers()
    }
    
    const interval = setInterval(pingAllServers, 30000)
    // Check for updates 3s after launch
    const updateTimer = setTimeout(() => setShowUpdateModal(true), 3000)
    return () => { clearInterval(interval); clearTimeout(updateTimer) }
  }, [profile.id, pingAllServers, initialStatuses])

  useEffect(() => {
    if (!canvasRef.current) return
    // Crack accounts always use Steve skin; Premium use their actual skin
    const skinUrl = profile.type === 'crack'
      ? 'https://minotar.net/skin/MHF_Steve'
      : (profile.customAvatar || `https://minotar.net/skin/${profile.name}`)
    const viewer = new SkinViewer({
      canvas: canvasRef.current, width: 200, height: 250,
      skin: skinUrl,
    })
    viewer.animation = new IdleAnimation()
    // Camera at safe distance — head & upper body centered
    viewer.camera.position.set(10, 24, 40)
    viewer.controls.target.set(0, 18, 0)
    viewer.controls.update()
    // Lock all interaction
    viewer.controls.enabled = false
    viewer.controls.enableZoom = false
    viewer.controls.enableRotate = false
    viewer.controls.enablePan = false
    // Face slightly left (profile-ish view)
    viewer.playerObject.rotation.y = -Math.PI / 8
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


  const updateRam = async (v: number) => { setRam(v); await window.ipcRenderer.invoke('update-settings', { ram: v }) }
  const updateVisuals = async (v: boolean) => { setEnableVisuals(v); await window.ipcRenderer.invoke('update-settings', { enableVisuals: v }) }
  const updateGamepad = async (v: boolean) => { setEnableGamepad(v); await window.ipcRenderer.invoke('update-settings', { enableGamepad: v, controllable: v }) }

  const switchProfile = async (p: any) => {
    await window.ipcRenderer.invoke('set-active-profile', p.id)
    if (onProfileSwitch) {
      onProfileSwitch(p)
      setShowAccounts(false)
    } else {
      window.location.reload()
    }
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
      <div className="w-64 shrink-0 flex flex-col justify-between relative z-20" style={{ background: 'rgba(17,17,24,0.95)', borderRight: `1px solid ${S.border}`, backdropFilter: 'blur(20px)' }}>

        {/* TOP: Avatar + Nav */}
        <div className="flex flex-col">
          {/* Avatar section */}
          <div className="flex flex-col items-center pt-5 pb-2 px-4">
          {/* Circular glowing avatar — 150px */}
          <div style={{
            position: 'relative', width: 150, height: 150, flexShrink: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 40%, rgba(0,212,255,0.1) 0%, rgba(10,10,20,0.95) 70%)',
            border: '2px solid rgba(0,212,255,0.6)',
            boxShadow: '0 0 0 5px rgba(0,212,255,0.07), 0 0 35px rgba(0,212,255,0.4), 0 0 70px rgba(79,142,247,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', marginBottom: 6,
          }}>
            <canvas ref={canvasRef} className="outline-none" style={{ width: 148, height: 188, display: 'block', transform: 'translateY(-60px)', pointerEvents: 'none' }} />
          </div>
            <div className="w-full relative">
              <button onClick={() => setShowAccounts(!showAccounts)} className="flex items-center gap-1.5 px-2 py-1 transition-colors rounded-md hover:bg-white/5 w-full justify-center">
                <span style={{ fontWeight: 800, fontSize: 15, color: S.text }}>{profile.name}</span>
                <ChevronDown size={14} style={{ color: S.text3, transform: showAccounts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <div className="flex justify-center">
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3, padding: '2px 10px', borderRadius: 20, background: profile.type === 'crack' ? S.surface3 : 'rgba(170,68,255,0.15)', color: profile.type === 'crack' ? S.text3 : S.epic, border: `1px solid ${profile.type === 'crack' ? S.border2 : 'rgba(170,68,255,0.3)'}`, display: 'inline-block' }}>
                  {profile.type === 'crack' ? 'Craqué' : '★ Premium'}
                </div>
              </div>
              {showAccounts && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50" style={{ background: S.surface, border: `1px solid ${S.border2}`, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>
                  {profiles.length > 0 ? profiles.map(p => (
                    <button key={p.id} onClick={() => switchProfile(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5">
                      {/* Mini skin face via minotar */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(0,212,255,0.4)', flexShrink: 0, background: S.surface3 }}>
                        <img src={p.type === 'crack' ? 'https://minotar.net/helm/MHF_Steve/32' : `https://minotar.net/helm/${p.name}/32`} alt={p.name} style={{ width: 32, height: 32, imageRendering: 'pixelated' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 9, color: p.type === 'crack' ? S.text3 : S.epic, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{p.type === 'crack' ? 'Craqué' : 'Premium'}</div>
                      </div>
                      <ChevronRight size={12} style={{ color: S.text3, flexShrink: 0 }} />
                    </button>
                  )) : <div style={{ padding: '10px 14px', fontSize: 11, color: S.text3, textAlign: 'center' }}>Aucun autre compte</div>}
                  <div style={{ borderTop: `1px solid ${S.border}` }}>
                    <button onClick={onLogout} className="w-full py-2.5 transition-colors hover:bg-white/5" style={{ fontSize: 11, color: S.accent, fontWeight: 600 }}>+ Ajouter un compte</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NAV — clean pill-style buttons */}
          <nav className="flex flex-col gap-0.5 px-3 pt-1 pb-2 flex-shrink-0">
            {[
              { id: 'home', label: 'Accueil', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              )},
              { id: 'map', label: 'Carte du Monde', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
              )},
              { id: 'settings', label: 'Paramètres', icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              )},
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as any)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: tab === item.id ? `linear-gradient(135deg, rgba(79,142,247,0.18), rgba(0,212,255,0.08))` : 'transparent',
                  color: tab === item.id ? S.accent : S.text2,
                  border: `1px solid ${tab === item.id ? 'rgba(79,142,247,0.35)' : 'transparent'}`,
                  boxShadow: tab === item.id ? '0 2px 12px rgba(79,142,247,0.12)' : 'none',
                }}
                onMouseEnter={e => { if (tab !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = S.text } }}
                onMouseLeave={e => { if (tab !== item.id) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = S.text2 } }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}

            {/* Support — separate styling */}
            <button
              onClick={() => openSupport()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all mt-1"
              style={{ color: S.text3, border: '1px solid transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = S.text2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = S.text3 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Support
            </button>
          </nav>
        </div>

        {/* Bottom — Astral logo + logout bubble, NO top border */}
        <div className="p-3 flex-shrink-0">
          <div className="flex flex-col items-center justify-center opacity-50 hover:opacity-100 transition-opacity mb-2">
            <img src={astralLogo} alt="Astral" style={{ width: 100, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(79,142,247,0.2))' }} />
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.18)', color: S.red }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,68,68,0.4)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,68,68,0.18)' }}
          >
            <LogOut size={14} />Déconnexion
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {tab === 'home' && (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Hero background — full height, strong fade top→black */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
              <img src={heroBg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', opacity: 0.5, filter: 'blur(0.5px) saturate(1.2)' }} />
              {/* Depth fade: visible image at top, pure black at bottom */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,15,0.05) 0%, rgba(10,10,15,0.25) 25%, rgba(10,10,15,0.7) 55%, rgba(10,10,15,0.95) 80%, rgba(10,10,15,1) 100%)' }} />
            </div>

            {/* Content over hero */}
            <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto overflow-x-hidden px-4 pt-6 pb-4">
              <img src={logo} alt="Azuria" className="w-24 h-24 object-contain mb-2" style={{ filter: 'drop-shadow(0 0 32px rgba(79,142,247,0.9))', animation: 'float 4s ease-in-out infinite' }} />
              <h1 className="font-black mb-1" style={{ fontSize: 34, letterSpacing: -2, background: 'linear-gradient(135deg, #fff 0%, #4f8ef7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AZURIA</h1>
              <p className="mb-4" style={{ color: S.text2, fontSize: 12 }}>Prêt à rejoindre l'aventure V4 ?</p>

              {/* Server card */}
              <div className="w-full max-w-md min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3 }}>Serveur</div>
                  <button onClick={pingAllServers} className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-white/5" style={{ fontSize: 10, color: S.text3 }}>
                    <RefreshCw size={10} />Actualiser
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {SERVERS.map(srv => {
                    const st = serverStatuses[srv.id]
                    const isOnline = srv.statusOverride ? false : st?.online === true
                    const bars = getPingBars(st?.ping)
                    return (
                      <button key={srv.id} onClick={() => !isBusy && !isRunning && setSelectedServer(srv.id)}
                        className="flex items-center gap-3 p-3 rounded-xl text-left transition-all w-full min-w-0 overflow-hidden"
                        style={{ background: selectedServer === srv.id ? 'rgba(79,142,247,0.12)' : S.surface, border: `1px solid ${selectedServer === srv.id ? 'rgba(79,142,247,0.4)' : S.border}`, boxShadow: selectedServer === srv.id ? '0 0 20px rgba(79,142,247,0.15)' : 'none', opacity: isBusy && selectedServer !== srv.id ? 0.5 : 1 }}>
                        {st?.favicon && !srv.statusOverride ? (
                          <img src={st.favicon} alt="" className="w-9 h-9 rounded" style={{ imageRendering: 'pixelated' }} />
                        ) : (
                          <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: S.surface3 }}>
                            <Server size={16} style={{ color: srv.statusOverride ? S.text3 : (isOnline ? S.accent : S.text3) }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span style={{ fontWeight: 700, fontSize: 13, color: S.text }}>{srv.name}</span>
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
                        {!srv.statusOverride && (
                          <div className="flex items-end gap-0.5 shrink-0">
                            {st?.ping ? (
                              <>
                                {[1,2,3,4,5].map(b => (
                                  <div key={b} style={{ width: 3, height: 4 + b * 2, borderRadius: 1, background: isOnline && bars >= b ? getPingColor(st?.ping) : S.border2, opacity: isOnline && bars >= b ? 1 : 0.3 }} />
                                ))}
                                <span style={{ fontSize: 9, color: getPingColor(st?.ping), marginLeft: 4 }}>{st.ping}ms</span>
                              </>
                            ) : isOnline ? (
                              <span style={{ fontSize: 9, color: S.green, fontWeight: 600 }}>●</span>
                            ) : null}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* News banner — responsive height */}
              <div className="w-full max-w-md mt-3 rounded-xl overflow-hidden cursor-pointer group" style={{ border: `1px solid ${S.border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', flexShrink: 0 }}
                onClick={() => window.ipcRenderer.invoke('open-external', 'https://azuria.astraltechnologie.fr')}>
                <div style={{ position: 'relative', height: 85 }}>
                  <img src={newsBanner} alt="Azuria V4" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,10,20,0.88) 0%, rgba(10,10,20,0.15) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', left: 12, bottom: 10, top: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.accent, marginBottom: 2 }}>Nouvelle aventure</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Azuria V4 — L'Ère Mécanique</div>
                    <div style={{ fontSize: 9, color: S.text2, marginTop: 2 }}>Aeronautics · Create · Ice and Fire Community</div>
                  </div>
                  <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 8, color: S.accent, fontWeight: 700 }}>En savoir plus</span>
                    <ChevronRight size={10} style={{ color: S.accent }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {tab === 'map' && (
          <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
            <iframe
              src="http://game03.octoheberg.fr:25589"
              className="flex-1 w-full h-full border-0"
              style={{ display: 'block' }}
              title="Carte interactive Azuria"
              onError={() => {}}
            />
          </div>
        )}

        {tab === 'settings' && (
          <div className="flex-1 p-5 overflow-hidden flex flex-col">
            <div className="mb-4">
              <h2 className="font-bold text-base" style={{ color: S.text }}>Paramètres du Lanceur</h2>
              <p className="text-xs" style={{ color: S.text3 }}>Configuration de l'expérience de jeu</p>
            </div>
            <div className="flex flex-col gap-2.5 overflow-hidden">

              {/* Row 1: Profile + Playtime side by side */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.2)' }}>
                    <User size={18} style={{ color: S.accent }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate" style={{ color: S.text }}>{profile.name}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginTop: 2, background: profile.type === 'crack' ? S.surface3 : 'rgba(170,68,255,0.15)', color: profile.type === 'crack' ? S.text3 : S.epic, border: `1px solid ${profile.type === 'crack' ? S.border2 : 'rgba(170,68,255,0.3)'}`, display: 'inline-block' }}>
                      {profile.type === 'crack' ? 'CRAQUÉ' : '★ PREMIUM'}
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                    <Clock size={18} style={{ color: S.accent2 }} />
                  </div>
                  <div>
                    <div className="font-bold text-xs" style={{ color: S.text }}>Temps de jeu</div>
                    <div className="font-black text-lg" style={{ color: S.accent2 }}>
                      {totalPlaySec < 3600 ? `${Math.floor(totalPlaySec / 60)}m` : `${Math.floor(totalPlaySec / 3600)}h${Math.floor((totalPlaySec % 3600) / 60) > 0 ? ` ${Math.floor((totalPlaySec % 3600) / 60)}m` : ''}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* RAM slider */}
              <div className="p-3 rounded-xl" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)' }}>
                      <Cpu size={18} style={{ color: S.accent }} />
                    </div>
                    <div>
                      <div className="font-bold text-xs" style={{ color: S.text }}>RAM allouée</div>
                      <div className="text-xs" style={{ color: ram < 4 ? S.red : ram < 6 ? S.orange : S.green }}>{ram < 4 ? '⚠ Insuffisant' : ram < 6 ? 'Minimum requis' : '✓ Recommandé'}</div>
                    </div>
                  </div>
                  <span className="font-black text-2xl" style={{ color: ram >= 8 ? S.green : ram >= 4 ? S.orange : S.red }}>{ram}G</span>
                </div>
                <input type="range" min={2} max={16} step={1} value={ram} onChange={e => updateRam(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: S.accent }} />
                <div className="flex justify-between text-xs mt-0.5" style={{ color: S.text3 }}>
                  <span>2G</span><span>4G</span><span>8G</span><span>12G</span><span>16G</span>
                </div>
              </div>

              {/* Row 3: Pack Visuel + Support Manette side by side */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all" style={{ background: S.surface, border: `1px solid ${enableVisuals ? 'rgba(79,142,247,0.4)' : S.border}` }} onClick={() => updateVisuals(!enableVisuals)}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: enableVisuals ? 'rgba(79,142,247,0.12)' : S.surface3, border: `1px solid ${enableVisuals ? 'rgba(79,142,247,0.2)' : S.border}` }}>
                    <Globe size={18} style={{ color: enableVisuals ? S.accent : S.text3 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs" style={{ color: S.text }}>Shaders & Packs de textures</div>
                    <div className="text-xs" style={{ color: S.text3 }}>{enableVisuals ? 'Activé (Complementary HD)' : 'Désactivé'}</div>
                  </div>
                  {enableVisuals ? <CheckCircle2 size={18} style={{ color: S.accent }} /> : <div className="w-4 h-4 rounded-full shrink-0" style={{ border: `2px solid ${S.border2}` }} />}
                </div>

                <div className="p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all" style={{ background: S.surface, border: `1px solid ${enableGamepad ? 'rgba(0,212,255,0.4)' : S.border}` }} onClick={() => updateGamepad(!enableGamepad)}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: enableGamepad ? 'rgba(0,212,255,0.12)' : S.surface3, border: `1px solid ${enableGamepad ? 'rgba(0,212,255,0.2)' : S.border}` }}>
                    <Gamepad2 size={18} style={{ color: enableGamepad ? S.accent2 : S.text3 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs" style={{ color: S.text }}>Support Manette</div>
                    <div className="text-xs" style={{ color: S.text3 }}>{enableGamepad ? 'Activé (Controlify)' : 'Désactivé'}</div>
                  </div>
                  {enableGamepad ? <CheckCircle2 size={18} style={{ color: S.accent2 }} /> : <div className="w-4 h-4 rounded-full shrink-0" style={{ border: `2px solid ${S.border2}` }} />}
                </div>
              </div>

              {/* Row 4: Version & Engine Info */}
              <div className="p-2.5 px-3 rounded-xl flex items-center justify-between" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2">
                  <Shield size={14} style={{ color: S.green }} />
                  <span className="text-xs font-semibold" style={{ color: S.text2 }}>NeoForge 21.1.230 • Minecraft 1.21.1</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(68,204,102,0.1)', color: S.green, border: '1px solid rgba(68,204,102,0.2)' }}>AZURIA V{appVersion || '4.0.15'}</span>
              </div>

              {/* Logout */}
              <button onClick={onLogout} className="flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm font-semibold transition-all" style={{ color: S.red, border: `1px solid rgba(255,68,68,0.2)`, background: 'rgba(255,68,68,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.12)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.04)' }}
              >
                <LogOut size={14} />Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* LAUNCH BAR — only on home tab */}
        {tab === 'home' && <div className="shrink-0 flex flex-col items-center gap-1.5 px-4 pt-3 pb-3" style={{ background: `linear-gradient(to top, ${S.bg} 60%, transparent 100%)` }}>

          {/* Progress bar — only when busy */}
          {isBusy && (
            <div className="w-full max-w-sm mb-1">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                <span style={{ color: S.text }}>{progress.task.replace(/\s*\(\d+%\)\s*$/i, '').replace(/\s*\d+%\s*$/i, '').trim()}</span>
                <span style={{ color: S.accent }}>{Math.max(0, Math.min(100, Math.round(progress.percent || 0)))}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: S.surface3 }}>
                <div className="h-full rounded-full transition-all duration-300 relative" style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${S.accent}, ${S.accent2})` }}>
                  <div className="absolute inset-0 opacity-40" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', animation: 'shimmer 1.5s infinite' }} />
                </div>
              </div>
            </div>
          )}

          {/* Error report row (only when isClosed + error) */}
          {isClosed && lastError && (
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', color: S.red, letterSpacing: 1 }}>
                {lastError.code}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: S.text }}>{lastError.label}</span>
              <button onClick={() => openSupport(lastError.code, lastError.message)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all"
                style={{ background: 'rgba(79,142,247,0.15)', border: '1px solid rgba(79,142,247,0.35)', color: S.accent }}>
                <Send size={10} />Rapport
              </button>
              <button onClick={() => navigator.clipboard.writeText(`${lastError.code}: ${lastError.label}\n${lastError.message}`)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`, color: S.text3 }}
                title="Copier le code d'erreur">
                <Copy size={10} />{lastError.code}
              </button>
            </div>
          )}

          {/* Button row — always centered */}
          <div className="flex items-center gap-2">
            {isRunning ? (
              <button onClick={handleStop} className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5" style={{ background: S.red, boxShadow: `0 0 24px rgba(255,68,68,0.4)` }}>
                <StopCircle size={18} />FERMER LE JEU
              </button>
            ) : isBusy ? (
              <button disabled className="flex items-center gap-2 px-10 py-3 rounded-xl font-black text-base text-white/50 cursor-not-allowed" style={{ background: S.surface3 }}>
                <span className="animate-spin inline-block">⟳</span> EN COURS...
              </button>
            ) : server.statusOverride || status?.online === false ? (
              <button disabled className="flex items-center gap-2 px-10 py-3 rounded-xl font-black text-base text-white/50 cursor-not-allowed" style={{ background: S.surface3 }}>
                <AlertTriangle size={18} />INDISPONIBLE
              </button>
            ) : isClosed ? (
              <button onClick={handleLaunch} className="group relative flex items-center gap-2 px-10 py-3 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${S.green}, #22aa44)`, boxShadow: `0 0 30px rgba(68,204,102,0.4)` }}>
                <RefreshCw size={18} />RELANCER
              </button>
            ) : (
              <button onClick={handleLaunch} className="group relative flex items-center gap-2 px-12 py-3 rounded-xl font-black text-base text-white transition-all hover:-translate-y-0.5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${S.accent}, #6ba3ff)`, boxShadow: `0 0 30px rgba(79,142,247,0.4)`, minWidth: 160, justifyContent: 'center' }}>
                <Play size={18} className="fill-current" />JOUER
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', transform: 'skewX(-12deg)' }} />
              </button>
            )}

            {/* Settings shortcut */}
            {!isRunning && !isBusy && (
              <button
                onClick={() => setTab('settings')}
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: S.surface, border: `1px solid ${S.border}`, color: S.text3 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = S.accent; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(79,142,247,0.4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = S.text3; (e.currentTarget as HTMLButtonElement).style.borderColor = S.border }}
                title="Paramètres"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            )}
          </div>

          {/* Info line below button */}
          <div className="flex items-center gap-2 text-xs" style={{ color: S.text3 }}>
            {isRunning ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: S.green, boxShadow: `0 0 6px ${S.green}`, animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontWeight: 700, color: S.green }}>EN COURS — {server.name}</span>
              </>
            ) : isClosed ? (
              <span style={{ color: S.text3 }}>Jeu fermé — Prêt à relancer</span>
            ) : isBusy ? null : (
              <>
                <span style={{ fontWeight: 600, color: S.text2 }}>{server.name}</span>
                <span>·</span>
                <span>{server.displayHost}</span>
                {server.statusOverride ? (
                  <span style={{ color: S.text3 }}>● {server.statusOverride}</span>
                ) : status?.online ? (
                  <span style={{ color: S.green }}>● {status.players?.online}/{status.players?.max} joueurs</span>
                ) : status && !status.online ? (
                  <span style={{ color: S.red }}>● Hors ligne</span>
                ) : null}
              </>
            )}
          </div>
        </div>}
      </div>

      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } } @keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } } @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}