// Vercel Serverless Function — Submit Support Ticket
// ENV: DISCORD_WEBHOOK_URL, ADMIN_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, category, description, errorCode, platform } = req.body || {}

  if (!description || !category) {
    return res.status(400).json({ error: 'Description et catégorie requises' })
  }

  const ticketId = `AZ-V4-${Date.now().toString(36).toUpperCase()}`
  const timestamp = new Date().toISOString()

  const CATEGORY_EMOJI = {
    'crash': '💥',
    'connexion': '🔌',
    'mods': '📦',
    'compte': '👤',
    'perf': '⚡',
    'autre': '❓'
  }
  const emoji = CATEGORY_EMOJI[category] || '❓'

  const CATEGORY_LABELS = {
    'crash': 'Crash / Erreur Launcher (AZ-008, etc.)',
    'connexion': 'Connexion / Serveur',
    'mods': 'Mods / Installation V4',
    'compte': 'Compte / Hors-ligne / Microsoft',
    'perf': 'Performances / FPS / RAM',
    'autre': 'Autre demande'
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `${emoji} [${ticketId}] ${CATEGORY_LABELS[category] || category}`,
          color: 0x38bdf8,
          fields: [
            { name: '👤 Joueur / Pseudo', value: name || 'Anonyme', inline: true },
            { name: '📧 Contact / Email', value: email || 'Non renseigné', inline: true },
            { name: '🖥️ Plateforme', value: platform || 'Launcher Windows', inline: true },
            ...(errorCode ? [{ name: '⚠️ Code Erreur', value: `\`${errorCode}\``, inline: true }] : []),
            { name: '📝 Description du problème', value: description.substring(0, 1000) }
          ],
          timestamp,
          footer: { text: `Azuria V4 Support — ${ticketId}` }
        }]
      })
    }).catch(console.error)
  }

  return res.status(200).json({
    success: true,
    ticketId,
    message: `Ticket ${ticketId} enregistré avec succès ! Notre équipe d'assistance vous répondra très rapidement.`
  })
}
