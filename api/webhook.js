const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getRawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Webhook Error: ' + err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const priceId = session.metadata?.priceId || session.line_items?.data?.[0]?.price?.id;
    const plan = priceId === process.env.STRIPE_PRICE_STANDARD ? 'standard' : 'lite';
    if (email) {
      try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;
        const user = users.find(u => u.email === email);
        if (user) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { plan } });
          console.log('Plan updated:', user.id, plan);
        }
      } catch (e) {
        console.error('Supabase update error:', e.message);
      }
    }
  }
  res.status(200).json({ received: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
