// Vercel Serverless Function — Submit Support Ticket
// ENV: DISCORD_WEBHOOK_URL, ADMIN_TOKEN

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, category, description, errorCode, platform } = req.body

  if (!description || !category) {
    return res.status(400).json({ error: 'Description et catégorie requises' })
  }

  const ticketId = `AZ-TK-${Date.now().toString(36).toUpperCase()}`
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
    'crash': 'Crash / Erreur',
    'connexion': 'Connexion / Serveur',
    'mods': 'Mods / Installation',
    'compte': 'Compte / Auth',
    'perf': 'Performances / FPS',
    'autre': 'Autre'
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `<@&1234567890> Nouveau ticket de support !`,
        embeds: [{
          title: `${emoji} [${ticketId}] ${CATEGORY_LABELS[category] || category}`,
          color: 0xaa44ff,
          fields: [
            { name: '👤 Utilisateur', value: name || 'Anonyme', inline: true },
            { name: '📧 Email', value: email || 'Non fourni', inline: true },
            { name: '🖥️ Plateforme', value: platform || 'Non précisé', inline: true },
            ...(errorCode ? [{ name: '⚠️ Code erreur', value: `\`${errorCode}\``, inline: true }] : []),
            { name: '📝 Description', value: description.substring(0, 1000) }
          ],
          timestamp,
          footer: { text: `Ticket ${ticketId} — Azuria Support` }
        }]
      })
    }).catch(console.error)
  }

  return res.status(200).json({
    success: true,
    ticketId,
    message: `Ticket ${ticketId} créé avec succès ! Nous vous répondrons dans les 24h.`
  })
}
