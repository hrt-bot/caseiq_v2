const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const PRICE_LITE = process.env.STRIPE_PRICE_LITE;
  const PRICE_STANDARD = process.env.STRIPE_PRICE_STANDARD;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;
    if (!email) return res.json({ received: true });

    // Get subscription details to find plan
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const priceId = subscription.items.data[0].price.id;

    let plan = 'lite';
    let limit = 8;
    if (priceId === PRICE_STANDARD) { plan = 'standard'; limit = 20; }

    // Find user by email in Supabase auth
    const { data: users } = await supa.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);
    if (user) {
      await supa.from('user_usage').upsert({
        id: user.id,
        plan,
        questions_limit: limit,
        stripe_subscription_id: session.subscription,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customer = await stripe.customers.retrieve(subscription.customer);
    const email = customer.email;
    const { data: users } = await supa.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);
    if (user) {
      await supa.from('user_usage').upsert({
        id: user.id,
        plan: 'free',
        questions_limit: 2,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
  }

  res.json({ received: true });
};
