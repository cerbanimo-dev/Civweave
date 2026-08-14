import { CivweaveCloudNode as BaseCloudNode } from './cloud-node-membership-v1.mjs';

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

async function capacityJson(node, pathname, body) {
  const response = await node.capacityStub().fetch(`https://capacity.internal${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Capacity returned HTTP ${response.status}`), { status: response.status });
  return payload;
}

export class CivweaveCloudNode extends BaseCloudNode {
  async applyPaymentCapacity(nodeId, event) {
    if (event?.type === 'hosting.plan.paid') {
      return capacityJson(this, '/settlements/hosting', {
        sourceId: clean(event.id, 240),
        nodeId,
        paidThrough: clean(event.paidThrough, 80),
        monthlyCents: Number(event.monthlyCents || 0),
        billingBand: clean(event.billingBand, 40),
      });
    }
    return super.applyPaymentCapacity(nodeId, event);
  }
}
