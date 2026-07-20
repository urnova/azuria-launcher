import { useEffect, useState, useRef } from 'react'
import logo from '../assets/logo.png'
import astralLogo from '../assets/astral-logo.png'

interface Props {
  onReady: (hasUpdate?: boolean, downloadUrl?: string, serverStatuses?: Record<string, any>) => void
}

const SERVERS = [
  { id: 'main', host: 'playazuria.astraltechnologie.fr', port: 25565 },
]

const steps = [
  { label: 'Initialisation du launcher...', duration: 600 },
  { label: 'Vérification des mises à jour...', duration: 0, type: 'update' },
  { label: 'Chargement des profils...', duration: 500 },
  { label: 'Ping des serveurs...', duration: 0, type: 'ping' },
  { label: 'Prêt !', duration: 400 },
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
    const fixedTotal = steps.reduce((s, x) => s + (x.duration || 1500), 0)

    const run = () => {
      if (current >= steps.length) {
        setFadeOut(true)
        setTimeout(() =>
          onReady(resultRef.current.hasUpdate, resultRef.current.downloadUrl, resultRef.current.serverStatuses),
          400
        )
        return
      }

      const step = steps[current]
      setStepIdx(current)

      // Async steps
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
              // Fallback API
              try {
                const apiRes = await fetch(`https://api.mcsrvstat.us/3/${srv.host}`)
                const apiData = await apiRes.json()
                results[srv.id] = apiData.online
                  ? { online: true, players: apiData.players ? { online: apiData.players.online, max: apiData.players.max } : undefined }
                  : { online: false }
              } catch {
                results[srv.id] = { online: false }
              }
            }
          } catch {
            results[srv.id] = { online: false }
          }
        })).then(() => {
          resultRef.current.serverStatuses = results
          elapsed += 1500
          current++
          run()
        })
        return
      }

      // Timed steps
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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(135deg, #06060e 0%, #0d0d1a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.4s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Glow background */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(79,142,247,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <img
        src={logo}
        alt="Azuria"
        style={{
          width: 110, height: 110, objectFit: 'contain', marginBottom: 24,
          filter: 'drop-shadow(0 0 40px rgba(79,142,247,0.6))',
          animation: 'splashFloat 3s ease-in-out infinite',
        }}
      />

      {/* Title */}
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 4, background: 'linear-gradient(135deg, #fff 0%, #4f8ef7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        AZURIA
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: '#5a5a7a', marginBottom: 48 }}>
        Launcher
      </div>

      {/* Progress bar */}
      <div style={{ width: 280 }}>
        <div style={{ height: 3, background: '#1c1c28', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            height: '100%', borderRadius: 999,
            background: 'linear-gradient(90deg, #4f8ef7, #00d4ff)',
            width: `${progress}%`,
            transition: 'width 0.1s linear',
            boxShadow: '0 0 10px rgba(79,142,247,0.6)',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#5a5a7a', textAlign: 'center', letterSpacing: 0.5, height: 16 }}>
          {steps[stepIdx]?.label}
        </div>
      </div>

      {/* Footer Logo — logo only, no "Technologie" text */}
      <div style={{ position: 'absolute', bottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={astralLogo} alt="Astral" style={{ width: 120, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(79,142,247,0.3))', opacity: 0.6 }} />
      </div>

      <style>{`
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
