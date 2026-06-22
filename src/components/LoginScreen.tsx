import { useState, useEffect } from 'react'
import { User, Loader2, AlertCircle, X, WifiOff, ChevronRight, Trash2, LogIn } from 'lucide-react'
import logo from '../assets/logo.png'

const S = {
  bg: '#0a0a0f', surface: '#111118', surface2: '#16161f', surface3: '#1c1c28',
  border: '#1e1e2e', border2: '#2a2a3d', accent: '#4f8ef7', accent2: '#00d4ff',
  epic: '#aa44ff', text: '#e8e8f0', text2: '#9999bb', text3: '#5a5a7a',
  green: '#44cc66', red: '#ff4444',
}

export default function LoginScreen({ onLogin }: { onLogin: (p: any) => void }) {
  const [mode, setMode] = useState<'SELECT' | 'CRACK'>('SELECT')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<any[]>([])

  useEffect(() => {
    window.ipcRenderer.invoke('get-all-profiles').then(saved => { if (saved) setProfiles(saved) })
  }, [])

  const handleCrackLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true); setErrorMsg(null)
    try {
      const profile = await window.ipcRenderer.invoke('login-crack', username.trim())
      onLogin(profile)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la connexion.')
    } finally { setLoading(false) }
  }

  const handleMicrosoftLogin = async () => {
    setLoading(true); setErrorMsg(null)
    try {
      const profile = await window.ipcRenderer.invoke('login-microsoft')
      if (profile?.error === 'no_game') {
        setErrorMsg("Ce compte Microsoft ne possède pas Minecraft Java Edition.\nAchetez-le sur minecraft.net ou utilisez le mode Hors Ligne ci-dessous.")
      } else if (profile?.error) {
        setErrorMsg(profile.error)
      } else if (profile) {
        onLogin(profile)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connexion Microsoft annulée ou échouée.')
    } finally { setLoading(false) }
  }

  const selectProfile = async (p: any) => {
    await window.ipcRenderer.invoke('set-active-profile', p.id)
    onLogin(p)
  }

  const deleteProfile = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const updated = await window.ipcRenderer.invoke('delete-profile', id)
    setProfiles(updated || [])
  }

  return (
    <div className="w-full h-full flex relative overflow-hidden" style={{ background: S.bg }}>
      {/* BG gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,142,247,0.10) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(170,68,255,0.07) 0%, transparent 60%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[380px] shrink-0">

          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <img src={logo} alt="Azuria" className="w-20 h-20 object-contain mb-3" style={{ filter: 'drop-shadow(0 0 20px rgba(79,142,247,0.5))' }} />
            <h1 className="font-black text-center" style={{ fontSize: 26, letterSpacing: -1, background: `linear-gradient(135deg, #fff 0%, ${S.accent2} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AZURIA V3</h1>
            <p style={{ fontSize: 12, color: S.text2, marginTop: 4 }}>Bienvenue, connectez-vous pour jouer.</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'rgba(17,17,24,0.95)', border: `1px solid ${S.border2}`, boxShadow: '0 24px 60px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)' }}>
                <AlertCircle size={15} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: '#ff9999', flex: 1, lineHeight: 1.5 }}>{errorMsg}</span>
                <button onClick={() => setErrorMsg(null)}><X size={14} style={{ color: S.text3 }} /></button>
              </div>
            )}

            {/* === SELECT mode === */}
            {mode === 'SELECT' && (
              <>
                {/* Saved profiles */}
                {profiles.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3, marginBottom: 8 }}>Profils enregistrés</div>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {profiles.map(p => (
                        <div key={p.id} className="group flex items-center gap-2">
                          <button onClick={() => selectProfile(p)}
                            className="flex-1 flex items-center gap-3 p-2.5 rounded-xl text-left transition-all"
                            style={{ background: S.surface2, border: `1px solid ${S.border}` }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = S.accent; e.currentTarget.style.background = S.surface3 }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = S.surface2 }}
                          >
                            {p.type === 'crack' ? (
                              <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: S.surface3, border: `1px solid ${S.border2}` }}>
                                <WifiOff size={14} style={{ color: S.text3 }} />
                              </div>
                            ) : (
                              <img src={`https://minotar.net/helm/${p.name}/36`} alt="" className="w-9 h-9 rounded-lg shrink-0" style={{ imageRendering: 'pixelated', background: '#000' }} onError={e => (e.currentTarget.style.display = 'none')} />
                            )}
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: S.text }}>{p.name}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: p.type === 'crack' ? S.text3 : S.epic }}>{p.type === 'crack' ? 'Hors Ligne' : '★ Premium'}</div>
                            </div>
                            <ChevronRight size={14} style={{ marginLeft: 'auto', color: S.text3 }} />
                          </button>
                          <button onClick={e => deleteProfile(e, p.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                            style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid transparent', color: S.red }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,68,68,0.4)'; e.currentTarget.style.background = 'rgba(255,68,68,0.18)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'rgba(255,68,68,0.08)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 1, background: S.border, margin: '12px 0' }} />
                  </div>
                )}

                {/* Microsoft */}
                <button onClick={handleMicrosoftLogin} disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: '#0078d4', boxShadow: '0 4px 20px rgba(0,120,212,0.35)' }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,120,212,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,120,212,0.35)')}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : (
                    <svg viewBox="0 0 21 21" width="16" height="16" fill="currentColor">
                      <rect x="1" y="1" width="9" height="9"/><rect x="11" y="1" width="9" height="9"/>
                      <rect x="1" y="11" width="9" height="9"/><rect x="11" y="11" width="9" height="9"/>
                    </svg>
                  )}
                  Connexion Microsoft (Premium)
                </button>

                {/* Offline */}
                <button onClick={() => setMode('CRACK')} disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: S.surface2, border: `1px solid ${S.border2}`, color: S.text2 }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = S.accent)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = S.border2)}
                >
                  <WifiOff size={16} />Mode Hors Ligne (Crack)
                </button>
              </>
            )}

            {/* === CRACK mode === */}
            {mode === 'CRACK' && (
              <form onSubmit={handleCrackLogin} className="flex flex-col gap-4">
                <button type="button" onClick={() => setMode('SELECT')}
                  style={{ fontSize: 12, color: S.text3, textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.color = S.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = S.text3)}
                >← Retour</button>

                {/* Info box */}
                <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(79,142,247,0.08)', border: `1px solid rgba(79,142,247,0.2)` }}>
                  <WifiOff size={14} style={{ color: S.accent, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: S.text2, lineHeight: 1.5 }}>
                    Mode hors-ligne — Aucun skin personnalisé.<br />
                    Le skin sera géré automatiquement par le serveur.
                  </span>
                </div>

                {/* Username */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3, display: 'block', marginBottom: 6 }}>Pseudonyme</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S.text3 }} />
                    <input type="text" placeholder="Votre pseudo Minecraft..." value={username}
                      onChange={e => setUsername(e.target.value)} autoFocus maxLength={16}
                      className="w-full rounded-xl pl-10 pr-4 py-3 text-sm font-medium transition-all outline-none"
                      style={{ background: S.surface2, border: `1px solid ${S.border2}`, color: S.text }}
                      onFocus={e => (e.target.style.borderColor = S.accent)}
                      onBlur={e => (e.target.style.borderColor = S.border2)}
                    />
                  </div>
                  <p style={{ fontSize: 10, color: S.text3, marginTop: 4 }}>{username.length}/16 caractères</p>
                </div>

                <button type="submit" disabled={!username.trim() || loading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(135deg, ${S.accent}, #6ba3ff)`, boxShadow: `0 4px 20px rgba(79,142,247,0.35)` }}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  Se connecter
                </button>
              </form>
            )}
          </div>

          <div className="text-center mt-4" style={{ fontSize: 10, color: S.text3 }}>
            playazuria.astraltechnologie.fr · v1.21.1 · Survival
          </div>
        </div>
      </div>
    </div>
  )
}
