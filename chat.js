export default async function handler(req, res) {
  // CORS — allow requests from your Vercel domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーがサーバーに設定されていません。Vercelの環境変数を確認してください。' });
  }

  try {
    const body = req.body;

    // Basic validation
    if (!body.messages || !Array.isArray(body.messages)) {
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
        model: body.model || 'claude-haiku-4-5-20251001',
        max_tokens: body.max_tokens || 600,
        system: body.system || '',
        messages: body.messages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      // 429 rate limit
      if (anthropicRes.status === 429) {
        const resetsAt = data?.resetsAt || data?.windows?.['5h']?.resets_at;
        let waitMsg = 'しばらくしてから再試行してください。';
        if (resetsAt) {
          const diff = Math.ceil((resetsAt * 1000 - Date.now()) / 60000);
          waitMsg = diff > 60
            ? `約${Math.ceil(diff / 60)}時間後にリセットされます。`
            : `約${diff}分後にリセットされます。`;
        }
        return res.status(429).json({ error: 'APIの利用制限に達しました。' + waitMsg });
      }
      return res.status(anthropicRes.status).json({ error: data?.error?.message || 'APIエラー' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'サーバーエラー: ' + err.message });
  }
}
