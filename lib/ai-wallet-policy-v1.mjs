const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

export const AI_PLAN_CATALOG_VERSION = 'civweave.ai-plans.v1';

export const AI_PLAN_CATALOG = deepFreeze({
  local: {
    id: 'local',
    label: 'Local',
    monthlyPriceCents: 0,
    hostedAllowanceCents: 0,
    targetReserveShareBps: 0,
    maxRequestCents: 0,
    dailyHostedLimitCents: 0,
    allowedHostedModels: []
  },
  thread: {
    id: 'thread',
    label: 'Thread',
    monthlyPriceCents: 500,
    hostedAllowanceCents: 200,
    targetReserveShareBps: 4000,
    maxRequestCents: 10,
    dailyHostedLimitCents: 25,
    allowedHostedModels: ['gemini-flash-lite', 'gemini-flash']
  },
  loom: {
    id: 'loom',
    label: 'Loom',
    monthlyPriceCents: 1500,
    hostedAllowanceCents: 750,
    targetReserveShareBps: 5000,
    maxRequestCents: 25,
    dailyHostedLimitCents: 100,
    allowedHostedModels: ['gemini-flash-lite', 'gemini-flash']
  },
  weaver: {
    id: 'weaver',
    label: 'Weaver',
    monthlyPriceCents: 3000,
    hostedAllowanceCents: 1800,
    targetReserveShareBps: 6000,
    maxRequestCents: 75,
    dailyHostedLimitCents: 300,
    allowedHostedModels: ['gemini-flash-lite', 'gemini-flash', 'gemini-pro']
  },
  studio: {
    id: 'studio',
    label: 'Studio',
    monthlyPriceCents: 7500,
    hostedAllowanceCents: 5100,
    targetReserveShareBps: 6800,
    maxRequestCents: 200,
    dailyHostedLimitCents: 900,
    allowedHostedModels: ['gemini-flash-lite', 'gemini-flash', 'gemini-pro', 'gemini-live']
  },
  node: {
    id: 'node',
    label: 'Node',
    monthlyPriceCents: 15000,
    hostedAllowanceCents: 11250,
    targetReserveShareBps: 7500,
    maxRequestCents: 500,
    dailyHostedLimitCents: 2500,
    allowedHostedModels: ['gemini-flash-lite', 'gemini-flash', 'gemini-pro', 'gemini-live']
  }
});

export const TOP_UP_BANDS = deepFreeze([
  { minimumGrossCents: 10000, providerShareBps: 7500 },
  { minimumGrossCents: 5000, providerShareBps: 7000 },
  { minimumGrossCents: 2000, providerShareBps: 6000 },
  { minimumGrossCents: 500, providerShareBps: 5000 }
]);

function integerCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer number of cents.`);
  }
  return value;
}

function nonEmpty(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

export function getAiPlan(planId) {
  const id = nonEmpty(planId, 'planId').toLowerCase();
  const plan = AI_PLAN_CATALOG[id];
  if (!plan) throw new RangeError(`Unknown Civweave AI plan: ${id}`);
  return plan;
}

export function allocateSubscriptionCharge({
  planId,
  grossCents,
  netDistributableCents
}) {
  const plan = getAiPlan(planId);
  const gross = integerCents(grossCents, 'grossCents');
  const net = integerCents(netDistributableCents, 'netDistributableCents');
  if (gross !== plan.monthlyPriceCents) {
    throw new RangeError(`The ${plan.id} plan expects a ${plan.monthlyPriceCents}-cent monthly charge.`);
  }
  if (net > gross) throw new RangeError('netDistributableCents cannot exceed grossCents.');

  const providerReserveCents = Math.floor(net * plan.targetReserveShareBps / 10000);
  const platformOperatingCents = net - providerReserveCents;
  const allowanceFundingGapCents = Math.max(0, plan.hostedAllowanceCents - providerReserveCents);

  return deepFreeze({
    schema: 'civweave.subscription-allocation.v1',
    catalogVersion: AI_PLAN_CATALOG_VERSION,
    planId: plan.id,
    grossCents: gross,
    netDistributableCents: net,
    hostedAllowanceCents: plan.hostedAllowanceCents,
    providerReserveCents,
    platformOperatingCents,
    allowanceFundingGapCents
  });
}

export function quoteTopUp({ grossCents, netDistributableCents }) {
  const gross = integerCents(grossCents, 'grossCents');
  const net = integerCents(netDistributableCents, 'netDistributableCents');
  if (net > gross) throw new RangeError('netDistributableCents cannot exceed grossCents.');
  const band = TOP_UP_BANDS.find(item => gross >= item.minimumGrossCents);
  if (!band) throw new RangeError('Hosted-AI top-ups begin at $5.00.');

  const hostedAllowanceCents = Math.floor(gross * band.providerShareBps / 10000);
  const providerReserveCents = Math.floor(net * band.providerShareBps / 10000);

  return deepFreeze({
    schema: 'civweave.ai-top-up-quote.v1',
    grossCents: gross,
    netDistributableCents: net,
    providerShareBps: band.providerShareBps,
    hostedAllowanceCents,
    providerReserveCents,
    platformOperatingCents: net - providerReserveCents,
    allowanceFundingGapCents: Math.max(0, hostedAllowanceCents - providerReserveCents)
  });
}

export function createWallet({
  walletId,
  userId,
  planId = 'local',
  balanceCents = 0,
  dailySpentCents = 0,
  dailyWindow = new Date().toISOString().slice(0, 10),
  reservations = {}
}) {
  const plan = getAiPlan(planId);
  return {
    schema: 'civweave.ai-wallet.v1',
    walletId: nonEmpty(walletId, 'walletId'),
    userId: nonEmpty(userId, 'userId'),
    planId: plan.id,
    balanceCents: integerCents(balanceCents, 'balanceCents'),
    reservedCents: Object.values(reservations).reduce((sum, item) => sum + integerCents(item.maxCostCents, 'reservation.maxCostCents'), 0),
    dailySpentCents: integerCents(dailySpentCents, 'dailySpentCents'),
    dailyWindow: nonEmpty(dailyWindow, 'dailyWindow'),
    reservations: structuredClone(reservations),
    updatedAt: new Date().toISOString()
  };
}

export function availableCents(wallet) {
  return Math.max(0, integerCents(wallet.balanceCents, 'wallet.balanceCents') - integerCents(wallet.reservedCents, 'wallet.reservedCents'));
}

function normalizeDailyWindow(wallet, at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) throw new TypeError('at must be a valid date.');
  const window = date.toISOString().slice(0, 10);
  if (wallet.dailyWindow === window) return structuredClone(wallet);
  return { ...structuredClone(wallet), dailyWindow: window, dailySpentCents: 0 };
}

export function reserveWalletSpend(wallet, {
  reservationId,
  maxCostCents,
  model,
  at = new Date().toISOString(),
  metadata = {}
}) {
  const id = nonEmpty(reservationId, 'reservationId');
  const maxCost = integerCents(maxCostCents, 'maxCostCents');
  const plan = getAiPlan(wallet.planId);
  const next = normalizeDailyWindow(wallet, at);
  if (next.reservations[id]) return next;
  if (!plan.allowedHostedModels.includes(model)) throw new RangeError(`Model ${model} is not enabled for the ${plan.id} plan.`);
  if (maxCost === 0 || maxCost > plan.maxRequestCents) {
    throw new RangeError(`Request reservation exceeds the ${plan.id} per-request limit.`);
  }
  if (next.dailySpentCents + next.reservedCents + maxCost > plan.dailyHostedLimitCents) {
    throw new RangeError(`Request reservation exceeds the ${plan.id} daily hosted-AI limit.`);
  }
  if (availableCents(next) < maxCost) throw new RangeError('Insufficient hosted-AI balance.');

  next.reservations[id] = {
    reservationId: id,
    maxCostCents: maxCost,
    model,
    metadata: structuredClone(metadata),
    createdAt: new Date(at).toISOString()
  };
  next.reservedCents += maxCost;
  next.updatedAt = new Date(at).toISOString();
  return next;
}

export function settleWalletSpend(wallet, {
  reservationId,
  actualCostCents,
  at = new Date().toISOString()
}) {
  const id = nonEmpty(reservationId, 'reservationId');
  const actual = integerCents(actualCostCents, 'actualCostCents');
  const next = normalizeDailyWindow(wallet, at);
  const reservation = next.reservations[id];
  if (!reservation) throw new RangeError(`Unknown reservation: ${id}`);
  if (actual > reservation.maxCostCents) {
    throw new RangeError('Actual provider cost cannot exceed the reserved maximum.');
  }

  delete next.reservations[id];
  next.reservedCents -= reservation.maxCostCents;
  next.balanceCents -= actual;
  next.dailySpentCents += actual;
  next.updatedAt = new Date(at).toISOString();
  return next;
}

export function cancelWalletReservation(wallet, reservationId, at = new Date().toISOString()) {
  const id = nonEmpty(reservationId, 'reservationId');
  const next = normalizeDailyWindow(wallet, at);
  const reservation = next.reservations[id];
  if (!reservation) return next;
  delete next.reservations[id];
  next.reservedCents -= reservation.maxCostCents;
  next.updatedAt = new Date(at).toISOString();
  return next;
}
