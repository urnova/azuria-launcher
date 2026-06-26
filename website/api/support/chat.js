// Vercel Serverless Function — Eva AI Support Chat (Groq)
// ENV: GROQ_API_KEY, DISCORD_WEBHOOK_URL

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

const EVA_SYSTEM_PROMPT = `Tu es Eva, l'assistante IA officielle du serveur Minecraft Azuria. Tu es chaleureuse, professionnelle et très compétente pour résoudre les problèmes techniques liés au launcher et au jeu.

## À PROPOS D'AZURIA
Azuria est un serveur Minecraft Java Edition médiéval-fantasy avec économie profonde, PvP, boss légendaires, quêtes épiques et métiers progressifs. IP: playazuria.astraltechnologie.fr

## LE LAUNCHER AZURIA
Le Launcher Azuria est une application Electron (Windows) qui :
- Gère les comptes Minecraft (Microsoft Premium et mode Hors-Ligne/Crack)
- Télécharge et installe automatiquement Minecraft + NeoForge + tous les mods requis
- Synchronise les mods depuis GitHub à chaque lancement (mods-v3.zip ou mods-v2.zip)
- Installe Java 21 automatiquement si absent
- Se connecte automatiquement au serveur sélectionné
- Supporte 3 serveurs : Azuria V2 (1.21.4), Azuria V3 Test (1.21.1), Azuria V3 (1.21.1 - indisponible)

## CODES D'ERREUR DU LAUNCHER
- **AZ-001** : Session Microsoft expirée → Solution: se déconnecter et se reconnecter avec le compte Microsoft
- **AZ-002** : Java 21 introuvable → Solution: le launcher va télécharger Java automatiquement, sinon réinstaller le launcher
- **AZ-003** : Minecraft non possédé → Ce compte Microsoft n'a pas acheté Minecraft Java Edition. Acheter sur minecraft.net ou utiliser le mode Hors-Ligne
- **AZ-004** : NeoForge introuvable → Les fichiers NeoForge manquent. Supprimer le dossier .azuria dans %APPDATA% et relancer
- **AZ-005** : Téléchargement échoué → Vérifier la connexion internet. Désactiver antivirus/pare-feu temporairement
- **AZ-006** : Extraction des mods échouée → Libérer de l'espace disque, vérifier les permissions du dossier AppData
- **AZ-007** : Archive des mods vide → Problème serveur temporaire, réessayer dans quelques minutes
- **AZ-999** : Erreur inconnue → Envoyer un ticket de support avec les logs

## PARAMÈTRES DU LAUNCHER
- **RAM** : Allocation mémoire (2G à 16G, recommandé 4G minimum)
- **Controlify** : Support manette PS4/Xbox/Switch Pro
- **Embeddium** : Optimisation FPS (sodium pour NeoForge, très recommandé)

## SERVEURS DISPONIBLES
- Azuria V2 (1.21.4 NeoForge) — Serveur actuel stable
- Azuria V3 Serveur de test (1.21.1) — Pour tester la V3 en développement
- Azuria V3 (1.21.1) — Serveur principal V3, actuellement indisponible (en développement)

## RÈGLES DE COMPORTEMENT
- Réponds TOUJOURS en français
- Sois concise mais complète
- Si le problème est complexe ou non résolu, propose d'envoyer un ticket humain
- Ne jamais inventer de solutions qui n'existent pas
- Si tu ne sais pas, dis-le honnêtement et propose un ticket
- Quand un code AZ-xxx est mentionné, explique immédiatement ce qu'il signifie et la solution

Commence par accueillir chaleureusement l'utilisateur et demander quel est son problème.`

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, errorCode, errorMsg, escalate } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // If user wants to escalate to human support, send to Discord
  if (escalate) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (webhookUrl) {
      const summary = messages.slice(-6).map(m => `**${m.role === 'user' ? '👤 Utilisateur' : '🤖 Eva'}**: ${m.content}`).join('\n')
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `🎫 Conversation Eva escaladée${errorCode ? ` — Code ${errorCode}` : ''}`,
            description: summary.substring(0, 4096),
            color: 0x4f8ef7,
            fields: errorCode ? [{ name: 'Code erreur', value: errorCode, inline: true }] : [],
            timestamp: new Date().toISOString(),
            footer: { text: 'Azuria Support — Eva AI' }
          }]
        })
      }).catch(console.error)
    }
    return res.status(200).json({ escalated: true })
  }

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  // Build context with error info if provided
  let systemPrompt = EVA_SYSTEM_PROMPT
  if (errorCode || errorMsg) {
    systemPrompt += `\n\n## CONTEXTE UTILISATEUR ACTUEL\nL'utilisateur arrive depuis le launcher avec${errorCode ? ` le code d'erreur **${errorCode}**` : ''}${errorMsg ? `\nMessage d'erreur: "${errorMsg}"` : ''}.\nCommence par reconnaître ce problème spécifique.`
  }

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-12) // Keep last 12 messages for context
        ],
        max_tokens: 512,
        temperature: 0.7
      })
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('Groq error:', err)
      return res.status(502).json({ error: 'Groq API error' })
    }

    const data = await groqRes.json()
    const reply = data.choices?.[0]?.message?.content || "Désolée, je n'ai pas pu traiter votre demande. Veuillez envoyer un ticket de support."

    return res.status(200).json({ reply })
  } catch (e) {
    console.error('Chat error:', e)
    return res.status(500).json({ error: 'Internal error' })
  }
}
