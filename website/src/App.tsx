import { useState, useEffect } from 'react'
import { Download, Gamepad2, Zap, Shield, ChevronRight, Loader2, Coins, ScrollText, Pickaxe, Users, Laptop } from 'lucide-react'

function App() {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://api.github.com/repos/urnova/azuria-launcher/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (data && data.assets) {
          const exeAsset = data.assets.find((a: any) => a.name.endsWith('.exe'))
          if (exeAsset) {
            setDownloadUrl(exeAsset.browser_download_url)
            setVersion(data.tag_name || '1.0.0')
          }
        }
      })
      .catch(err => console.error("Failed to fetch latest release:", err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="relative w-full min-h-screen overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(79,142,247,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 85% 110%, rgba(170,68,255,0.1) 0%, transparent 60%)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      {/* Navbar */}
      <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Azuria" className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(79,142,247,0.5)]" />
          <span className="font-extrabold text-xl tracking-tight text-white">AZURIA</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-300">
          <a href="#" className="hover:text-white transition-colors">Accueil</a>
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#install" className="hover:text-white transition-colors">Installation</a>
        </div>
        <a href="https://discord.gg/azuria" target="_blank" rel="noreferrer" className="glass-panel px-5 py-2 rounded-full text-sm font-bold text-white hover:bg-white/5 transition-colors border border-white/10">
          Rejoindre le Discord
        </a>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="glass-panel px-4 py-1.5 rounded-full text-xs font-bold text-[#00d4ff] uppercase tracking-widest mb-8 border-[#00d4ff]/20 bg-[#00d4ff]/5 inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse"></span>
          Azuria V3 est disponible
        </div>
        
        <img src="/logo.png" alt="Azuria Logo" className="w-32 h-32 md:w-48 md:h-48 object-contain mb-6 animate-float drop-shadow-[0_0_40px_rgba(79,142,247,0.4)]" />
        
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
          L'Aventure <span className="text-gradient">Minecraft</span><br />
          Réinventée.
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl font-light">
          Un serveur médiéval-fantasy unique avec une économie profonde, boss légendaires, quêtes épiques et métiers progressifs.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          {/* Mobile Only Button */}
          <button disabled className="sm:hidden w-full glass-panel px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg text-white opacity-90 cursor-not-allowed border border-white/10">
            <Laptop className="w-6 h-6 text-gray-400" />
            Téléchargement PC uniquement
          </button>

          {/* Desktop Download Button */}
          <div className="hidden sm:block w-full sm:w-auto">
            {loading ? (
              <button disabled className="w-full glass-panel px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg text-white opacity-80 cursor-wait">
                <Loader2 className="animate-spin w-6 h-6 text-[#4f8ef7]" />
                Recherche de version...
              </button>
            ) : downloadUrl ? (
              <a href={downloadUrl} className="w-full px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg text-white hover:-translate-y-1 transition-all duration-300 relative group overflow-hidden" style={{ background: 'linear-gradient(135deg, #4f8ef7, #6ba3ff)', boxShadow: '0 10px 30px -10px rgba(79,142,247,0.6)' }}>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <Download className="w-6 h-6 relative z-10" />
                <span className="relative z-10 flex flex-col items-start text-left">
                  <span>Télécharger pour Windows</span>
                  <span className="text-[10px] font-normal opacity-80 uppercase tracking-widest leading-none mt-1">{version}</span>
                </span>
              </a>
            ) : (
              <button disabled className="w-full glass-panel px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg text-white opacity-50 cursor-not-allowed">
                <Shield className="w-6 h-6 text-red-400" />
                Téléchargement indisponible
              </button>
            )}
          </div>
          
          <a href="#install" className="w-full sm:w-auto px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg text-gray-300 hover:text-white glass-panel hover:bg-white/5 transition-all duration-300 border border-white/10">
            Guide d'installation <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </main>

      {/* Features - Imported from V2 */}
      <section id="features" className="relative z-10 container mx-auto px-6 py-24 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold mb-4">Tout ce qui fait Azuria</h2>
          <p className="text-gray-400">Un écosystème complet pensé pour durer.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#00d4ff]/10 flex items-center justify-center mb-6 border border-[#00d4ff]/20 group-hover:scale-110 transition-transform">
              <Coins className="w-7 h-7 text-[#00d4ff]" />
            </div>
            <h3 className="text-xl font-bold mb-3">Économie Profonde</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Une monnaie unique — l'Azur Cristal (AC) — guidée par la valeur des items, un marché joueur, une boutique admin et des lootboxes.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Marché joueur</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Lootboxes</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#4f8ef7]/10 flex items-center justify-center mb-6 border border-[#4f8ef7]/20 group-hover:scale-110 transition-transform">
              <Pickaxe className="w-7 h-7 text-[#4f8ef7]" />
            </div>
            <h3 className="text-xl font-bold mb-3">Métiers & Compétences</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Choisissez votre voie : Mineur, Chasseur ou Fermier. Montez jusqu'au niveau 50, débloquez des passifs et du gear exclusif.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Niveau 1 à 50</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Passifs Uniques</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#aa44ff]/10 flex items-center justify-center mb-6 border border-[#aa44ff]/20 group-hover:scale-110 transition-transform">
              <Shield className="w-7 h-7 text-[#aa44ff]" />
            </div>
            <h3 className="text-xl font-bold mb-3">60+ Items Custom</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Pioches, épées, armures, arcs et artefacts. 6 niveaux de rareté, des effets uniques et une valeur économique précise.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Commun → Mythique</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Sets Complets</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#f74f8e]/10 flex items-center justify-center mb-6 border border-[#f74f8e]/20 group-hover:scale-110 transition-transform">
              <ScrollText className="w-7 h-7 text-[#f74f8e]" />
            </div>
            <h3 className="text-xl font-bold mb-3">Quêtes & Histoire</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Progressez dans les Chroniques d'Azuria, complétez des quêtes secondaires et relevez les défis journaliers.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Défis Journaliers</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#4ff7b2]/10 flex items-center justify-center mb-6 border border-[#4ff7b2]/20 group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-[#4ff7b2]" />
            </div>
            <h3 className="text-xl font-bold mb-3">Équipes & Social</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Créez ou rejoignez une équipe (team), gérez vos résidences (homes), et participez aux événements pour le classement.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Teams</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Homes</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300 group">
            <div className="w-14 h-14 rounded-2xl bg-[#f7b24f]/10 flex items-center justify-center mb-6 border border-[#f7b24f]/20 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-7 h-7 text-[#f7b24f]" />
            </div>
            <h3 className="text-xl font-bold mb-3">PvP & Arène</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Défiez d'autres joueurs en duel, invoquez des boss légendaires dans l'arène et réclamez les reliques puissantes.</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Duels</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/5 border border-white/10">Boss Invocables</span>
            </div>
          </div>
        </div>
      </section>

      {/* Guide d'installation */}
      <section id="install" className="relative z-10 container mx-auto px-6 py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto glass-panel p-10 rounded-3xl">
          <h2 className="text-3xl font-extrabold mb-8 text-center">Comment jouer ?</h2>
          <div className="space-y-6 relative">
            <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-white/10" />
            
            <div className="flex gap-6 relative">
              <div className="w-10 h-10 rounded-full bg-[#4f8ef7] text-white font-bold flex items-center justify-center shrink-0 z-10 shadow-[0_0_15px_rgba(79,142,247,0.5)]">1</div>
              <div>
                <h4 className="text-lg font-bold mb-1">Télécharger le Launcher</h4>
                <p className="text-gray-400 text-sm">Cliquez sur le bouton de téléchargement plus haut depuis un PC pour récupérer l'installeur Windows (.exe).</p>
              </div>
            </div>
            
            <div className="flex gap-6 relative">
              <div className="w-10 h-10 rounded-full bg-[#1c1c28] border border-white/20 text-white font-bold flex items-center justify-center shrink-0 z-10">2</div>
              <div>
                <h4 className="text-lg font-bold mb-1">Installer et contourner SmartScreen</h4>
                <p className="text-gray-400 text-sm">Lors de l'ouverture, Windows affichera peut-être un écran bleu "Windows a protégé votre ordinateur". Cliquez sur <strong>"Informations complémentaires"</strong> puis <strong>"Exécuter quand même"</strong>. C'est normal pour un nouveau jeu !</p>
              </div>
            </div>
            
            <div className="flex gap-6 relative">
              <div className="w-10 h-10 rounded-full bg-[#1c1c28] border border-white/20 text-white font-bold flex items-center justify-center shrink-0 z-10">3</div>
              <div>
                <h4 className="text-lg font-bold mb-1">Se connecter et Lancer</h4>
                <p className="text-gray-400 text-sm">Ouvrez le Launcher Azuria, connectez-vous avec votre compte Premium ou Crack, et cliquez sur Jouer !</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 mt-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-semibold">
          <div>© 2026 Astral Technologie. Tous droits réservés.</div>
          <div className="flex gap-6">
            <a href="https://discord.gg/azuria" className="hover:text-white transition-colors">Discord</a>
            <span>IP: playazuria.astraltechnologie.fr</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
