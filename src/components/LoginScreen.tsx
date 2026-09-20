import { useState, useEffect } from 'react'
import { User, Loader2, AlertCircle, X, WifiOff, ChevronRight, Trash2, LogIn } from 'lucide-react'
import logo from '../assets/logo.png'

const S = {
  bg: '#09090f', surface: '#111119', surface2: '#16161f', surface3: '#1c1c28',
  border: '#1e1e2e', border2: '#272738', accent: '#4f8ef7', accent2: '#00d4ff',
  epic: '#aa44ff', text: '#e8e8f0', text2: '#9090b0', text3: '#505068',
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
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ background: S.bg, borderRadius: 12 }}>
      {/* BG glows */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(79,142,247,0.08) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '20%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(170,68,255,0.06) 0%, transparent 65%)' }} />
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px', position: 'relative', zIndex: 1 }}>

        {/* Logo + Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <img src={logo} alt="Azuria" style={{
            width: 80, height: 80, objectFit: 'contain', marginBottom: 14,
            filter: 'drop-shadow(0 0 28px rgba(79,142,247,0.6))',
            animation: 'loginFloat 4s ease-in-out infinite',
          }} />
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -1, background: 'linear-gradient(135deg, #fff 0%, #4f8ef7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
            AZURIA V4
          </div>
          <div style={{ fontSize: 11, color: S.text3, letterSpacing: 0.5 }}>
            {mode === 'SELECT' ? 'Sélectionne ton compte pour jouer' : 'Connexion hors-ligne'}
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.22)', marginBottom: 16 }}>
            <AlertCircle size={14} style={{ color: S.red, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#ff9999', flex: 1, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}><X size={13} style={{ color: S.text3 }} /></button>
          </div>
        )}

        {/* === SELECT MODE === */}
        {mode === 'SELECT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Saved profiles */}
            {profiles.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3, marginBottom: 8 }}>
                  Profils enregistrés
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {profiles.map(p => (
                    <div key={p.id} className="group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => selectProfile(p)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: S.surface2, border: `1px solid ${S.border}`, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = S.accent; (e.currentTarget as HTMLButtonElement).style.background = S.surface3 }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = S.border; (e.currentTarget as HTMLButtonElement).style.background = S.surface2 }}
                      >
                        {/* Avatar */}
                        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: S.surface3, border: `1px solid ${S.border2}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.type === 'premium'
                            ? <img src={`https://minotar.net/helm/${p.name}/36`} alt="" style={{ width: 36, height: 36, imageRendering: 'pixelated' }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }} />
                            : <img src="https://minotar.net/helm/MHF_Steve/36" alt="Steve" style={{ width: 36, height: 36, imageRendering: 'pixelated' }} />
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: S.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: p.type === 'crack' ? S.text3 : S.epic, letterSpacing: 0.5 }}>
                            {p.type === 'crack' ? 'CRAQUÉ' : '★ Premium'}
                          </div>
                        </div>
                        <ChevronRight size={14} style={{ color: S.text3, flexShrink: 0 }} />
                      </button>
                      <button
                        onClick={e => deleteProfile(e, p.id)}
                        style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: '1px solid transparent', color: S.red, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'all 0.15s', flexShrink: 0 }}
                        className="group-hover:opacity-100"
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,68,68,0.3)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Separator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 8px' }}>
                  <div style={{ flex: 1, height: 1, background: S.border }} />
                  <span style={{ fontSize: 10, color: S.text3, fontWeight: 600, letterSpacing: 1 }}>NOUVEAU COMPTE</span>
                  <div style={{ flex: 1, height: 1, background: S.border }} />
                </div>
              </div>
            )}

            {/* Microsoft */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, background: '#0078d4', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(0,120,212,0.3)' }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(0,120,212,0.5)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,120,212,0.3)')}
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
            <button
              onClick={() => setMode('CRACK')}
              disabled={loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, background: S.surface2, border: `1px solid ${S.border2}`, color: S.text2, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}
              onMouseEnter={e => !loading && ((e.currentTarget as HTMLButtonElement).style.borderColor = S.accent)}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = S.border2)}
            >
              <WifiOff size={15} />
              Mode Hors Ligne (Crack)
            </button>

            {/* Footer info */}
            <div style={{ textAlign: 'center', fontSize: 10, color: S.text3, marginTop: 4 }}>
              playazuria.astraltechnologie.fr · NeoForge 1.21.1
            </div>
          </div>
        )}

        {/* === CRACK MODE === */}
        {mode === 'CRACK' && (
          <form onSubmit={handleCrackLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button type="button" onClick={() => setMode('SELECT')}
              style={{ fontSize: 12, color: S.text3, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 4 }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = S.text)}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = S.text3)}
            >← Retour</button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(79,142,247,0.06)', border: `1px solid rgba(79,142,247,0.18)` }}>
              <WifiOff size={13} style={{ color: S.accent, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: S.text2, lineHeight: 1.6 }}>
                Mode hors-ligne — votre skin sera géré par le serveur Azuria.
              </span>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: S.text3, display: 'block', marginBottom: 8 }}>Pseudonyme</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: S.text3 }} />
                <input
                  type="text" placeholder="Votre pseudo Minecraft..." value={username}
                  onChange={e => setUsername(e.target.value)} autoFocus maxLength={16}
                  style={{ width: '100%', background: S.surface2, border: `1px solid ${S.border2}`, borderRadius: 12, padding: '12px 14px 12px 38px', color: S.text, fontSize: 14, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = S.accent)}
                  onBlur={e => (e.target.style.borderColor = S.border2)}
                />
              </div>
              <div style={{ fontSize: 10, color: S.text3, marginTop: 5, textAlign: 'right' }}>{username.length}/16</div>
            </div>

            <button type="submit" disabled={!username.trim() || loading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px 20px', borderRadius: 12, background: `linear-gradient(135deg, ${S.accent}, #6ba3ff)`, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (!username.trim() || loading) ? 'not-allowed' : 'pointer', opacity: (!username.trim() || loading) ? 0.5 : 1, transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(79,142,247,0.3)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={15} />}
              Se connecter
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
