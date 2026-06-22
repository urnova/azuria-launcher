import { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import Dashboard from './components/Dashboard'
import { Square, Minus, X } from 'lucide-react'
import logo from './assets/logo.png'

export default function App() {
  const [activeProfile, setActiveProfile] = useState<any>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.ipcRenderer.invoke('get-active-profile').then(saved => {
      if (saved) setActiveProfile(saved)
    })
    window.ipcRenderer.on('window-maximized', () => setIsMaximized(true))
    window.ipcRenderer.on('window-unmaximized', () => setIsMaximized(false))
  }, [])

  const handleMaximize = () => {
    window.ipcRenderer.send('window-maximize')
    // Toggle locally immediately for responsiveness
    setIsMaximized(prev => !prev)
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0f', color: '#e8e8f0', border: '1px solid #1c1c28' }}>
      {/* Titlebar */}
      <div className="h-9 w-full flex items-center justify-between px-3 shrink-0 drag-region" style={{ background: '#0d0d14', borderBottom: '1px solid #1c1c28' }}>
        <div className="flex items-center gap-2 no-drag-region">
          <img src={logo} alt="" className="w-5 h-5 object-contain opacity-90" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#9999bb' }}>
            Azuria <span style={{ color: '#4f8ef7', fontWeight: 400 }}>Launcher</span>
          </span>
        </div>
        <div className="flex no-drag-region">
          <button
            onClick={() => window.ipcRenderer.send('window-minimize')}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c28')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c28')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isMaximized
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="3" y="0" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="0" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="#0d0d14"/></svg>
              : <Square size={12} />
            }
          </button>
          <button
            onClick={() => window.ipcRenderer.send('window-close')}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: '#9999bb' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#cc3333'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9999bb' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 relative overflow-hidden">
        {activeProfile ? (
          <Dashboard profile={activeProfile} onLogout={() => setActiveProfile(null)} />
        ) : (
          <LoginScreen onLogin={p => setActiveProfile(p)} />
        )}
      </div>
    </div>
  )
}
