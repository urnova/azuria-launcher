// ============================================================
//  Azuria — Netlify Function : start-server.js
//  Proxy sécurisé vers l'API MineStrator
//
//  Variable d'environnement à définir dans Netlify :
//    MINESTRATOR_API_KEY  → ta clé API MineStrator
// ============================================================

const SERVER_ID = '434210';

exports.handler = async (event) => {

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Lecture du body ──────────────────────────────────────
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const API_KEY = process.env.MINESTRATOR_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Clé API manquante.' }) };
  }

  // ── Mode ADMIN : toggle maintenance ─────────────────────
  // POST { action: 'admin', code: '42130', maintenance: true/false }
  if (body.action === 'admin') {
    if (body.code !== '42130') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Code invalide.' }) };
    }
    // On stocke l'état maintenance dans une variable globale (reset au cold start)
    // Pour une persistance réelle, utiliser Netlify Blobs ou KV
    global._azuria_maintenance = body.maintenance === true;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        maintenance: global._azuria_maintenance,
        message: global._azuria_maintenance ? '🔒 Maintenance activée.' : '✅ Maintenance désactivée.'
      })
    };
  }

  // ── Vérif status maintenance ─────────────────────────────
  if (body.action === 'status') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ maintenance: global._azuria_maintenance === true })
    };
  }

  // ── START serveur ────────────────────────────────────────
  if (global._azuria_maintenance === true) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'maintenance', message: '🔧 Serveur en maintenance. Réessaie plus tard !' })
    };
  }

  try {
    const response = await fetch(
      `https://panel.minestrator.com/api/client/servers/${SERVER_ID}/power`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ signal: 'start' }),
      }
    );

    if (response.status === 204 || response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Serveur en cours de démarrage !' })
      };
    }

    const errorText = await response.text();
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify({ error: `Erreur API MineStrator : ${errorText}` })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Erreur réseau : ${err.message}` })
    };
  }
};
