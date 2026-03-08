const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId, userEmail } = req.body;

  const ALLOWED_PRICES = [
    process.env.STRIPE_PRICE_LITE,
    process.env.STRIPE_PRICE_STANDARD,
  ];
  if (!ALLOWED_PRICES.includes(priceId)) {
    return res.status(400).json({ error: 'Invalid price' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: userEmail || undefined,
      success_url: `${process.env.APP_URL || 'https://caseiq-v2.vercel.app'}?payment=success`,
      cancel_url: `${process.env.APP_URL || 'https://caseiq-v2.vercel.app'}?payment=cancel`,
      locale: 'ja',
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
};
