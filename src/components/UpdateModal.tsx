import { useState, useEffect } from 'react'
import { Download, RefreshCw, X, ArrowRight } from 'lucide-react'

const S = {
  bg: '#0a0a0f', surface: '#111118', surface2: '#16161f',
  border2: '#2a2a3d', accent: '#4f8ef7', accent2: '#00d4ff',
  text: '#e8e8f0', text2: '#9999bb', text3: '#5a5a7a',
  green: '#44cc66',
}

interface UpdateInfo {
  hasUpdate: boolean
  currentVersion?: string
  latestVersion?: string
  releaseNotes?: string
}

export default function UpdateModal() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    window.ipcRenderer.invoke('check-for-updates').then((res: UpdateInfo) => {
      setInfo(res)
      setChecking(false)
    }).catch(() => {
      setInfo({ hasUpdate: false })
      setChecking(false)
    })

    window.ipcRenderer.on('update-progress', (_e: any, pct: number) => {
      setDownloadProgress(pct)
    })
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    const res = await window.ipcRenderer.invoke('download-update')
    if (res?.done) setDownloaded(true)
    setDownloading(false)
  }

  const handleInstall = () => {
    window.ipcRenderer.invoke('install-update')
  }

  const forceClose = () => {
    window.ipcRenderer.send('window-close')
  }

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className="rounded-2xl p-6 flex items-center gap-3" style={{ background: S.surface, border: `1px solid ${S.border2}` }}>
          <RefreshCw size={18} className="animate-spin" style={{ color: S.accent }} />
          <span style={{ color: S.text2, fontSize: 14 }}>Vérification des mises à jour...</span>
        </div>
      </div>
    )
  }

  if (!info?.hasUpdate) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: S.surface, border: `1px solid ${S.border2}`, boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(79,142,247,0.15)', border: `1px solid rgba(79,142,247,0.3)` }}>
              <Download size={18} style={{ color: S.accent }} />
            </div>
            <div>
              <div className="font-black" style={{ color: S.text, fontSize: 16 }}>Mise à jour disponible</div>
              <div style={{ fontSize: 12, color: S.text3 }}>v{info.currentVersion} → v{info.latestVersion}</div>
            </div>
          </div>
          <button onClick={forceClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ color: S.text3 }} title="Fermer le launcher">
            <X size={16} />
          </button>
        </div>

        {/* Release notes */}
        {info.releaseNotes && (
          <div className="p-3 rounded-xl text-sm" style={{ background: S.surface2, border: `1px solid ${S.border2}`, color: S.text2, fontSize: 12, maxHeight: 120, overflowY: 'auto', lineHeight: 1.6 }}>
            {typeof info.releaseNotes === 'string' ? info.releaseNotes : 'Nouvelle version disponible.'}
          </div>
        )}

        {/* Progress */}
        {downloading && (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: S.text2 }}>Téléchargement en cours...</span>
              <span style={{ color: S.accent, fontWeight: 700 }}>{downloadProgress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: S.surface2 }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%`, background: `linear-gradient(90deg, ${S.accent}, ${S.accent2})` }} />
            </div>
          </div>
        )}

        {downloaded && (
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(68,204,102,0.08)', border: '1px solid rgba(68,204,102,0.25)' }}>
            <span style={{ fontSize: 12, color: S.green }}>✓ Téléchargé ! Le launcher va redémarrer.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <button onClick={forceClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-white/5"
            style={{ border: `1px solid ${S.border2}`, color: S.text2 }}
          >
            Quitter
          </button>

          {downloaded ? (
            <button onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${S.green}, #22aa44)`, boxShadow: '0 4px 15px rgba(68,204,102,0.35)' }}
            >
              Redémarrer <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleDownload} disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${S.accent}, #6ba3ff)`, boxShadow: '0 4px 15px rgba(79,142,247,0.35)' }}
            >
              {downloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Mettre à jour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
