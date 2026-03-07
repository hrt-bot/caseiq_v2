export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーがサーバーに設定されていません。' });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages が必要です' });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 600,
        system: system || '',
        messages,
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      if (anthropicRes.status === 429) {
        return res.status(429).json({ error: 'APIの利用制限に達しました。しばらくしてから再試行してください。' });
      }
      return res.status(anthropicRes.status).json({ error: data?.error?.message || 'APIエラー' });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'サーバーエラー: ' + err.message });
  }
}
