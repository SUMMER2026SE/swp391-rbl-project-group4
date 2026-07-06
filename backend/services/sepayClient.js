'use strict';

const SEPAY_BASE_URL = 'https://my.sepay.vn/userapi';

function getHeaders() {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) throw new Error('SEPAY_API_TOKEN is not configured.');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * List recent transactions from SePay.
 * @param {object} params
 * @param {string} [params.account_number]
 * @param {number} [params.limit=20]
 * @param {string} [params.since_id]           - paginate after this transaction ID
 * @param {string} [params.transaction_date_min] - "YYYY-MM-DD HH:MM:SS"
 */
async function listTransactions(params = {}) {
  const qs = new URLSearchParams();
  if (params.account_number) qs.set('account_number', params.account_number);
  if (params.limit)          qs.set('limit', String(params.limit));
  if (params.since_id)       qs.set('since_id', params.since_id);
  if (params.transaction_date_min) qs.set('transaction_date_min', params.transaction_date_min);
  if (params.transaction_date_max) qs.set('transaction_date_max', params.transaction_date_max);
  if (params.amount_in)      qs.set('amount_in', String(params.amount_in));

  const url = `${SEPAY_BASE_URL}/transactions/list?${qs.toString()}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SePay API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json.status !== 200) throw new Error(`SePay returned status ${json.status}`);
  return json.transactions || [];
}

/**
 * Normalise a raw SePay transaction row into a consistent internal shape.
 */
function normalizeTransaction(raw) {
  return {
    externalId:         String(raw.id || ''),
    referenceNumber:    raw.reference_number || '',
    accountNumber:      raw.sub_account || raw.virtual_account_number || '',
    bankBrandName:      raw.bank_brand_name || raw.gateway || '',
    amountIn:           parseFloat(raw.amount_in || raw.transferAmount || 0),
    amountOut:          parseFloat(raw.amount_out || 0),
    content:            raw.transaction_content || raw.content || '',
    transactionDate:    raw.transaction_date
      ? new Date(raw.transaction_date).toISOString()
      : new Date().toISOString(),
    raw,
  };
}

module.exports = { listTransactions, normalizeTransaction };
