import { useEffect, useState, useRef } from 'react'
import logo from '../assets/logo.png'
import astralLogo from '../assets/astral-logo.png'

interface Props {
  onReady: (hasUpdate?: boolean, downloadUrl?: string, serverStatuses?: Record<string, any>) => void
}

const SERVERS = [
  { id: 'main', host: 'game03.octoheberg.fr', port: 25570 },
]

const STEPS = [
  { label: 'Initialisation du launcher...', duration: 600 },
  { label: 'Vérification des mises à jour...', duration: 0, type: 'update' },
  { label: 'Chargement des profils...', duration: 500 },
  { label: 'Connexion aux serveurs...', duration: 0, type: 'ping' },
  { label: 'Prêt !', duration: 350 },
]

export default function SplashScreen({ onReady }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const resultRef = useRef<{
    hasUpdate?: boolean
    downloadUrl?: string
    serverStatuses?: Record<string, any>
  }>({})

  useEffect(() => {
    let current = 0
    let elapsed = 0
    const fixedTotal = STEPS.reduce((s, x) => s + (x.duration || 1500), 0)

    const run = () => {
      if (current >= STEPS.length) {
        setProgress(100)
        setFadeOut(true)
        setTimeout(() =>
          onReady(resultRef.current.hasUpdate, resultRef.current.downloadUrl, resultRef.current.serverStatuses),
          450
        )
        return
      }

      const step = STEPS[current]
      setStepIdx(current)

      if (step.type === 'update') {
        window.ipcRenderer.invoke('check-for-updates').then((res: any) => {
          resultRef.current.hasUpdate = res?.hasUpdate === true
          if (res?.downloadUrl) resultRef.current.downloadUrl = res.downloadUrl
          elapsed += 1500
          current++
          run()
        }).catch(() => { current++; run() })
        return
      }

      if (step.type === 'ping') {
        const results: Record<string, any> = {}
        Promise.all(SERVERS.map(async srv => {
          try {
            const res = await window.ipcRenderer.invoke('ping-server', srv.host, srv.port)
            if (res?.online) {
              results[srv.id] = res
            } else {
              try {
                const apiRes = await fetch(`https://api.mcsrvstat.us/3/${srv.host}:${srv.port}`)
                const apiData = await apiRes.json()
                results[srv.id] = apiData.online
                  ? { online: true, players: apiData.players ? { online: apiData.players.online, max: apiData.players.max } : undefined }
                  : { online: false }
              } catch { results[srv.id] = { online: false } }
            }
          } catch { results[srv.id] = { online: false } }
        })).then(() => {
          resultRef.current.serverStatuses = results
          elapsed += 1500
          current++
          run()
        })
        return
      }

      const startProgress = (elapsed / fixedTotal) * 100
      const endProgress = ((elapsed + step.duration) / fixedTotal) * 100
      const start = Date.now()

      const anim = setInterval(() => {
        const frac = Math.min(1, (Date.now() - start) / step.duration)
        setProgress(startProgress + (endProgress - startProgress) * frac)
        if (frac >= 1) {
          clearInterval(anim)
          elapsed += step.duration
          current++
          run()
        }
      }, 16)
    }
    run()
  }, [])

  const pct = Math.max(0, Math.min(100, Math.round(progress)))

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 9999, borderRadius: 12, overflow: 'hidden',
      background: 'linear-gradient(145deg, #06060d 0%, #0c0c1a 60%, #080810 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.45s ease',
      opacity: fadeOut ? 0 : 1,
      pointerEvents: fadeOut ? 'none' : 'all',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(79,142,247,0.1) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(170,68,255,0.06) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '15%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,212,255,0.05) 0%, transparent 70%)' }} />
      </div>

      {/* Logo */}
      <img src={logo} alt="Azuria" style={{
        width: 100, height: 100, objectFit: 'contain',
        marginBottom: 22,
        filter: 'drop-shadow(0 0 40px rgba(79,142,247,0.65))',
        animation: 'splashFloat 3.5s ease-in-out infinite',
      }} />

      {/* Title */}
      <div style={{
        fontSize: 30, fontWeight: 900, letterSpacing: -0.5, marginBottom: 5,
        background: 'linear-gradient(135deg, #ffffff 20%, #4f8ef7 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>AZURIA</div>

      {/* Subtitle */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: '#3a3a58', marginBottom: 52 }}>
        L'ÈRE MÉCANIQUE · V4
      </div>

      {/* Progress section */}
      <div style={{ width: 300 }}>
        {/* Bar */}
        <div style={{ height: 3, background: '#141422', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%', borderRadius: 999,
            background: 'linear-gradient(90deg, #3d7fff, #00d4ff)',
            width: `${pct}%`,
            transition: 'width 0.12s linear',
            boxShadow: '0 0 10px rgba(79,142,247,0.7), 0 0 20px rgba(0,212,255,0.3)',
          }} />
        </div>

        {/* Label + percentage */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#4a4a6e', letterSpacing: 0.3 }}>
            {STEPS[stepIdx]?.label}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4f8ef7' }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 20 }}>
        <img src={astralLogo} alt="Astral" style={{ width: 100, opacity: 0.35, filter: 'drop-shadow(0 0 6px rgba(79,142,247,0.2))' }} />
      </div>

      <style>{`
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-9px); }
        }
      `}</style>
    </div>
  )
}
