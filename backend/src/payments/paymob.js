/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — Paymob payment gateway adapter (real flow).
   ═══════════════════════════════════════════════════════════════ */

function isEnvCandidate(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) &&
    ('PAYMOB_SECRET_KEY' in v || 'PAYMOB_INTEGRATION_ID' in v || 'PAYMOB_IFRAME_ID' in v);
}

function resolveArgs(args) {
  let env = null;
  let amount;
  let currency;
  let customerInfo;
  const rest = [];
  for (const a of args) {
    if (isEnvCandidate(a)) env = a;
    else rest.push(a);
  }
  for (const a of rest) {
    if (typeof a === 'number') amount = a;
    else if (typeof a === 'string') {
      if (a.length <= 6 && /^[A-Za-z]{3,4}$/.test(a)) currency = a;
      else if (amount === undefined) amount = Number(a);
      else currency = currency || a;
    } else if (a && typeof a === 'object') {
      customerInfo = a;
    }
  }
  if (amount === undefined) amount = 0;
  if (!currency) currency = 'EGP';
  if (!customerInfo) customerInfo = {};
  if (!env) {
    if (typeof process !== 'undefined' && process && process.env) {
      env = {
        PAYMOB_SECRET_KEY: process.env.PAYMOB_SECRET_KEY,
        PAYMOB_INTEGRATION_ID: process.env.PAYMOB_INTEGRATION_ID,
        PAYMOB_IFRAME_ID: process.env.PAYMOB_IFRAME_ID
      };
    } else {
      env = {};
    }
  }
  return { env: env, amount: Number(amount) || 0, currency: String(currency || 'EGP'), customerInfo: customerInfo };
}

function billingData(customerInfo) {
  const info = customerInfo || {};
  const name = String(info.name || info.customer_name || 'Customer').trim();
  const parts = name.split(/\s+/);
  const first = parts[0] || 'Customer';
  const last = parts.slice(1).join(' ') || 'Customer';
  return {
    apartment: 'NA',
    email: info.email || 'customer@dotstudio.app',
    floor: 'NA',
    first_name: first,
    street: info.address || 'NA',
    building: 'NA',
    phone_number: info.phone || info.phone_number || '01000000000',
    shipping_method: 'PKG',
    postal_code: 'NA',
    city: info.city || 'Cairo',
    country: 'EG',
    last_name: last,
    state: info.city || 'Cairo'
  };
}

export async function createPaymentIntent(...args) {
  const { env, amount, currency, customerInfo } = resolveArgs(args);
  const secretKey = env.PAYMOB_SECRET_KEY;
  const integrationId = env.PAYMOB_INTEGRATION_ID;
  const iframeId = env.PAYMOB_IFRAME_ID;

  const amountCents = Math.round((Number(amount) || 0) * 100);
  const cur = currency || 'EGP';

  try {
    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: secretKey })
    });
    if (!authRes.ok) {
      const text = await authRes.text().catch(() => '');
      throw new Error('Paymob auth failed: ' + authRes.status + ' ' + text);
    }
    const authData = await authRes.json();
    const authToken = authData.token;

    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents,
        currency: cur,
        delivery_needed: false,
        items: []
      })
    });
    if (!orderRes.ok) {
      const text = await orderRes.text().catch(() => '');
      throw new Error('Paymob order registration failed: ' + orderRes.status + ' ' + text);
    }
    const orderData = await orderRes.json();
    const orderId = orderData.id;

    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents,
        order_id: orderId,
        currency: cur,
        integration_id: Number(integrationId),
        billing_data: billingData(customerInfo)
      })
    });
    if (!keyRes.ok) {
      const text = await keyRes.text().catch(() => '');
      throw new Error('Paymob payment key failed: ' + keyRes.status + ' ' + text);
    }
    const keyData = await keyRes.json();
    const paymentToken = keyData.token;

    const iframeUrl = 'https://accept.paymob.com/api/acceptance/iframes/' + iframeId + '?payment_token=' + paymentToken;

    return {
      ok: true,
      provider: 'paymob',
      amount: Number(amount) || 0,
      amount_cents: amountCents,
      currency: cur,
      customer: customerInfo,
      order_id: orderId,
      payment_token: paymentToken,
      iframe_url: iframeUrl,
      payment_url: iframeUrl
    };
  } catch (e) {
    return {
      ok: false,
      provider: 'paymob',
      error: (e && e.message) ? e.message : String(e)
    };
  }
}

export default { createPaymentIntent };