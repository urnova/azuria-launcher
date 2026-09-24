// Vercel Serverless Function — Evan AI Support Chat (Groq + Zero-Failure Local Knowledge Base)
// ENV: GROQ_API_KEY, DISCORD_WEBHOOK_URL

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

const EVAN_SYSTEM_PROMPT = `Tu es Evan, l'assistant officiel et expert technique d'Azuria V4. Tu es chaleureux, clair, bienveillant et extrêmement précis pour aider les joueurs.

## CONTEXTE AZURIA V4
- Azuria est en version V4 sur Minecraft Java 1.21.1 avec NeoForge 21.1.230.
- Le serveur tourne sur un processeur haute performance AMD Ryzen 9 avec un tickrate stable (20 TPS).
- IP du serveur : playazuria.astraltechnologie.fr:25570 (ou playazuria.astraltechnologie.fr).
- Carte interactive 3D BlueMap disponible sur le site (onglet Carte).
- Transition V3 -> V4 : La map est 100% préservée ! Les joueurs ont conservé leurs constructions, leurs bases et leurs claims. Seul l'argent et certains métiers ont été remis à zéro pour garantir une économie dynamique.
- Économie avec l'Azur Cristal (AC), hôtels des ventes, quêtes, métiers, boss d'arène avec KeepInventory.
- Système de tombes (5 minutes de protection) et boussole de reconnexion temporaire (10 secondes).

## LE LAUNCHER AZURIA (v4.0.33)
- Application Electron pour Windows 10/11.
- Télécharge et installe automatiquement Java 21, Minecraft 1.21.1, NeoForge et le pack de mods V4.
- Supporte les comptes Microsoft officiels ET le mode Hors-Ligne (totalement gratuit, aucun compte payant requis).
- Intègre Embeddium (Sodium pour NeoForge) pour booster les FPS, support des manettes (Controlify), chat vocal (Simple Voice Chat).

## CODES D'ERREUR DU LAUNCHER
- **AZ-001** : Session Microsoft expirée. Solution : se déconnecter puis se reconnecter avec le compte Microsoft dans le launcher.
- **AZ-002** : Java 21 introuvable. Solution : relancer le launcher avec les droits admin pour qu'il télécharge le runtime Java 21, ou spécifier manuellement un Java 21 64-bit dans les paramètres.
- **AZ-003** : Compte sans licence Minecraft officielle. Solution : Utiliser le mode "Hors-Ligne" disponible gratuitement dans le sélecteur de compte du launcher.
- **AZ-004** : NeoForge corrompu ou manquant. Solution : Supprimer le dossier %APPDATA%\\.azuria puis relancer le launcher.
- **AZ-005** : Téléchargement interrompu / réseau. Solution : Vérifier la connexion internet et désactiver temporairement l'antivirus ou VPN.
- **AZ-006** : Extraction des mods échouée. Solution : Libérer de l'espace sur le disque C: et vérifier les permissions de %APPDATA%.
- **AZ-007** : Archive des mods vide ou corrompue. Solution : Problème réseau temporaire, relancer le launcher.
- **AZ-008** : Crash du jeu au démarrage (ex: client jar manquant). Solution : Mettre à jour vers le Launcher Azuria v4.0.33 ! Cette version installe automatiquement les bibliothèques et le client NeoForge. Vérifier aussi d'allouer au moins 4 Go de RAM (recommandé 6 à 8 Go).
- **AZ-999** : Erreur inconnue. Solution : Vérifier les logs dans %APPDATA%\\.azuria\\logs et ouvrir un ticket.

## CONSIGNES
- Réponds TOUJOURS en français avec un ton convivial et rassurant.
- Reste concis, formate tes réponses avec des puces et du gras pour faciliter la lecture.
- Si le problème n'est pas résolu, propose d'ouvrir un ticket support ou de rejoindre le Discord (https://discord.gg/fyVdHD8CtM).`

// Smart offline rule engine when GROQ_API_KEY is unset or fails
function getLocalSmartAnswer(userMessage, errorCode, errorMsg) {
  const msg = (userMessage || '').toLowerCase()
  const code = (errorCode || '').toUpperCase()

  if (code === 'AZ-008' || msg.includes('az-008') || msg.includes('az008') || msg.includes('crash') || msg.includes('ferme tout seul') || msg.includes('fermeture')) {
    return `### 💥 Résolution du Crash / Erreur AZ-008

Le crash au lancement sous NeoForge 1.21.1 survient généralement lors d'une première installation ou d'un manque de mémoire :

1. **Mettre à jour le Launcher** : Télécharge la dernière version **4.0.33** sur notre page [Télécharger](/download). Le launcher s'occupe désormais d'exécuter l'installateur officiel NeoForge en arrière-plan pour générer tous les fichiers requis.
2. **Allouer plus de RAM** : Dans les paramètres du launcher (icône ⚙️), passe l'allocation mémoire à **4 Go minimum** (6 à 8 Go recommandés si ton PC le permet).
3. **Nettoyage rapide** : Si le souci persiste, supprime le dossier \`%APPDATA%\\.azuria\\versions\` puis relance le launcher pour une réinstallation propre.

Si le crash persiste, envoie-nous un ticket avec ton fichier \`latest.log\` !`
  }

  if (code === 'AZ-001' || msg.includes('az-001') || msg.includes('session') || msg.includes('expire')) {
    return `### 🔑 Erreur AZ-001 : Session Microsoft expirée

Ton jeton d'authentification a expiré auprès des serveurs Microsoft :
- Clique sur ton pseudo en haut du launcher.
- Déconnecte-toi puis reconnecte-toi avec ton compte Microsoft.
- Si le problème persiste, tu peux basculer temporairement sur le mode **Hors-Ligne** pour tester.`
  }

  if (code === 'AZ-002' || msg.includes('az-002') || msg.includes('java')) {
    return `### ☕ Erreur AZ-002 : Java 21 requis

Azuria V4 fonctionne sous Minecraft 1.21.1 et requiert **Java 21 64-bit** :
- Le launcher essaie de le télécharger automatiquement dans \`%APPDATA%\\.azuria\\runtime\`.
- Vérifie que ton antivirus ne bloque pas le téléchargement.
- Tu peux aussi installer manuellement Java 21 (Eclipse Temurin ou Oracle) et pointer son chemin dans les paramètres du launcher.`
  }

  if (code === 'AZ-003' || msg.includes('az-003') || msg.includes('non possede') || msg.includes('acheter') || msg.includes('crack') || msg.includes('gratuit')) {
    return `### 🎮 Rejoindre gratuitement (Mode Hors-Ligne)

Sur Azuria, **le jeu est 100% accessible même sans compte payant** !
- Dans le launcher Azuria, au moment de choisir ton compte, choisis **Compte Hors-Ligne**.
- Entre le pseudo de ton choix et clique sur Jouer.
- Si tu possèdes un compte officiel Minecraft, assure-toi d'être connecté avec le compte Microsoft qui possède la licence.`
  }

  if (code === 'AZ-004' || msg.includes('az-004') || msg.includes('neoforge')) {
    return `### ⚙️ Erreur AZ-004 : NeoForge introuvable

Des composants essentiels du moteur NeoForge n'ont pas été finalisés :
1. Ferme complètement le launcher.
2. Appuie sur **Windows + R**, tape \`%APPDATA%\` et valide.
3. Supprime ou renomme le dossier \`.azuria\`.
4. Relance le Launcher Azuria v4.0.33 pour relancer une installation propre et complète.`
  }

  if (code === 'AZ-005' || msg.includes('az-005') || msg.includes('telechargement') || msg.includes('connexion')) {
    return `### 🌐 Erreur AZ-005 : Téléchargement interrompu

Le launcher n'a pas pu contacter GitHub ou le serveur d'hébergement :
- Vérifie ta connexion internet.
- Désactive temporairement ton VPN, proxy ou le pare-feu de ton antivirus.
- Relance le launcher en mode administrateur.`
  }

  if (code === 'AZ-006' || code === 'AZ-007' || msg.includes('az-006') || msg.includes('az-007') || msg.includes('mods')) {
    return `### 📦 Erreur AZ-006 / AZ-007 : Extraction des mods

L'archive des mods V4 n'a pas pu être décompressée correctement :
- Vérifie que tu as au moins **3 Go d'espace libre** sur ton disque dur principal (C:).
- Redémarre ton ordinateur si des fichiers étaient verrouillés en tâche de fond.
- Relance le launcher pour déclencher à nouveau la synchronisation automatique.`
  }

  if (msg.includes('v4') || msg.includes('v3') || msg.includes('perdu') || msg.includes('map') || msg.includes('affaires') || msg.includes('serveur')) {
    return `### 🐉 Azuria V4 : Ce qui change

- **La Map est conservée !** Tu retrouveras l'intégralité de tes constructions, bases et claims de la V3. Rien n'a été rasé.
- **Nouvelle Économie V4** : Les portefeuilles et les métiers ont été réinitialisés pour offrir un nouveau départ équitable à tous.
- **Performances Ryzen 9** : Serveur fluide à 20 TPS constant avec NeoForge 1.21.1.
- **Carte 3D BlueMap** : Tu peux visualiser le monde en temps réel sur la page [Carte](/map).`
  }

  if (msg.includes('ram') || msg.includes('lag') || msg.includes('fps')) {
    return `### ⚡ Optimisation des performances & RAM

- **Allouer de la RAM** : Ouvre le launcher > clique sur les Paramètres (roue dentée) > règle la mémoire entre **4 Go et 8 Go** (ne dépasse pas 50% de la RAM totale de ton PC).
- **Embeddium** est pré-installé : il multiplie souvent par 3 les FPS par rapport au Minecraft vanilla.
- Ferme les applications gourmandes en arrière-plan (navigateurs avec beaucoup d'onglets, logiciels de capture).`
  }

  if (msg.includes('bonjour') || msg.includes('salut') || msg.includes('hello') || msg.includes('aide')) {
    return `Bonjour ! 👋 Je suis **Evan**, l'assistant technique d'Azuria V4.

Je peux t'aider pour :
- Résoudre un crash ou un code d'erreur (AZ-001 à AZ-008, AZ-999)
- Installer et configurer le launcher
- Rejoindre en mode gratuit / hors-ligne
- Optimiser tes FPS et ta mémoire RAM
- Retrouver la carte 3D BlueMap et les infos sur la V4

Dis-moi quel est ton problème ou ce que tu souhaites savoir !`
  }

  return `Bonjour ! Je suis **Evan**, l'assistant d'Azuria V4. 

J'ai bien noté ton message. Pour t'aider au mieux :
1. Si tu rencontres un problème avec le launcher, indique-moi le message exact ou le code d'erreur affiché (ex: **AZ-008**, **AZ-001**, crash au lancement...).
2. Assure-toi de posséder la dernière version du launcher (**v4.0.33**) depuis la page [Télécharger](/download).
3. Tu peux également nous transmettre un ticket via l'onglet **Envoyer un ticket** ou nous rejoindre directement sur notre [Discord officiel](https://discord.gg/fyVdHD8CtM) !`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, errorCode, errorMsg, escalate } = req.body || {}

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Escalation to Discord Webhook
  if (escalate) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (webhookUrl) {
      const summary = messages.slice(-6).map(m => `**${m.role === 'user' ? '👤 Joueur' : '🤖 Evan'}**: ${m.content}`).join('\n')
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `🎫 Conversation Evan AI escaladée${errorCode ? ` — Code ${errorCode}` : ''}`,
            description: summary.substring(0, 4000),
            color: 0x38bdf8,
            fields: errorCode ? [{ name: 'Code erreur', value: `\`${errorCode}\``, inline: true }] : [],
            timestamp: new Date().toISOString(),
            footer: { text: 'Azuria V4 Support — Evan AI' }
          }]
        })
      }).catch(console.error)
    }
    return res.status(200).json({ escalated: true, message: 'Conversation transmise au staff avec succès !' })
  }

  const userLastMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''
  const groqKey = process.env.GROQ_API_KEY

  // If no Groq Key, use smart local engine immediately (ZERO 500 ERROR!)
  if (!groqKey) {
    const fallbackReply = getLocalSmartAnswer(userLastMsg, errorCode, errorMsg)
    return res.status(200).json({ reply: fallbackReply, source: 'knowledge-base' })
  }

  // Build context with error info
  let systemPrompt = EVAN_SYSTEM_PROMPT
  if (errorCode || errorMsg) {
    systemPrompt += `\n\n## CONTEXTE UTILISATEUR ACTUEL\nL'utilisateur arrive depuis le launcher avec${errorCode ? ` le code d'erreur **${errorCode}**` : ''}${errorMsg ? `\nMessage d'erreur: "${errorMsg}"` : ''}.\nCommence par apporter la solution directe.`
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
          ...messages.slice(-10)
        ],
        max_tokens: 600,
        temperature: 0.6
      })
    })

    if (!groqRes.ok) {
      console.warn('Groq API error, falling back to local engine:', await groqRes.text())
      const fallbackReply = getLocalSmartAnswer(userLastMsg, errorCode, errorMsg)
      return res.status(200).json({ reply: fallbackReply, source: 'fallback' })
    }

    const data = await groqRes.json()
    const reply = data.choices?.[0]?.message?.content || getLocalSmartAnswer(userLastMsg, errorCode, errorMsg)

    return res.status(200).json({ reply, source: 'ai' })
  } catch (e) {
    console.error('Chat error fallback:', e)
    const fallbackReply = getLocalSmartAnswer(userLastMsg, errorCode, errorMsg)
    return res.status(200).json({ reply: fallbackReply, source: 'fallback' })
  }
}
