import { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import SplashScreen from './components/SplashScreen'
import UpdateModal from './components/UpdateModal'
import { Minus, X } from 'lucide-react'
import logo from './assets/logo.png'

export default function App() {
  const [activeProfile, setActiveProfile] = useState<any>(null)
  const [splashDone, setSplashDone] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [initialStatuses, setInitialStatuses] = useState<Record<string, any>>({})
  const [appVersion, setAppVersion] = useState<string>('')
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.ipcRenderer.invoke('get-app-version').then(v => {
      if (v) setAppVersion(v)
    })
    // Track maximize/unmaximize for border-radius
    const onMax   = () => setIsMaximized(true)
    const onUnmax = () => setIsMaximized(false)
    window.ipcRenderer.on('window-maximized',   onMax)
    window.ipcRenderer.on('window-unmaximized', onUnmax)
    return () => {
      window.ipcRenderer.off?.('window-maximized',   onMax)
      window.ipcRenderer.off?.('window-unmaximized', onUnmax)
    }
  }, [])

  const br = isMaximized ? 0 : 12

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden"
      style={{ background: '#0a0a0f', color: '#e8e8f0', border: isMaximized ? 'none' : '1px solid #2a2a3d', borderRadius: br }}>
      {/* Splash screen */}
      {!splashDone && <SplashScreen onReady={(hasUpdate, _, statuses) => {
        if (statuses) setInitialStatuses(statuses);
        setSplashDone(true);
        if (hasUpdate) setShowUpdate(true)
      }} />}
      {splashDone && showUpdate && <UpdateModal onClose={() => setShowUpdate(false)} />}

      {/* Titlebar */}
      <div className="h-9 w-full flex items-center justify-between pl-3 shrink-0 drag-region"
        style={{ background: '#0d0d14', borderBottom: '1px solid #1c1c28', borderRadius: `${br}px ${br}px 0 0`, overflow: 'hidden' }}>
        <div className="flex items-center gap-2 no-drag-region">
          <img src={logo} alt="" className="w-5 h-5 object-contain opacity-90" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#9999bb' }}>
            Azuria <span style={{ color: '#4f8ef7', fontWeight: 400 }}>Launcher</span>
            {appVersion && <span style={{ marginLeft: 6, fontSize: 9, color: '#5a5a7a', letterSpacing: 1 }}>v{appVersion}</span>}
          </span>
        </div>
        <div className="flex no-drag-region">
          {/* Minimize */}
          <button onClick={() => window.ipcRenderer.send('window-minimize')}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c28')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Minus size={14} />
          </button>
          {/* Maximize */}
          <button onClick={() => window.ipcRenderer.send('window-maximize')}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c28')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Agrandir / Restaurer">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="0.65" y="0.65" width="9.7" height="9.7" rx="1" />
            </svg>
          </button>
          {/* Close */}
          <button onClick={() => window.ipcRenderer.send('window-close')}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb', borderRadius: `0 ${br}px 0 0` }}
            onMouseEnter={e => { e.currentTarget.style.background = '#cc3333'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9999bb' }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden" style={{ borderRadius: `0 0 ${br}px ${br}px` }}>
        {activeProfile ? (
          <Dashboard profile={activeProfile} onLogout={() => setActiveProfile(null)} onProfileSwitch={(p) => setActiveProfile(p)} initialStatuses={initialStatuses} />
        ) : (
          <LoginScreen onLogin={p => setActiveProfile(p)} />
        )}
      </div>
    </div>
  )
}
