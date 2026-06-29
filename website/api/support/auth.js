module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const adminToken = process.env.ADMIN_TOKEN;

        // If no token is set in Vercel, fallback to hardcoded
        const expectedToken = adminToken || 'azuria-admin-2025';

        if (password === expectedToken) {
            return res.status(200).json({ success: true, token: 'validated' });
        } else {
            return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
        }

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
