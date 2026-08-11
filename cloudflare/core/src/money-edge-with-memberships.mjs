import {
  CloudflareMoneyEdge as BaseMoneyEdge,
  moneyEdgeError,
  derToPem,
  TOPUP_ECONOMY,
  NODE_MONEY_EDGE_SCHEMA,
  NODE_MONEY_EVENT_SCHEMA,
  NODE_MONEY_CHALLENGE_DOMAIN,
  NODE_MONEY_REQUEST_DOMAIN,
  MONEY_EDGE_EVENT_DOMAIN,
  NODE_MONEY_ENROLLMENT_SCHEMA,
  splitTopupServiceNet
} from './money-edge.mjs';
import {
  MEMBERSHIP_ECONOMY,
  MEMBERSHIP_TIERS,
  createMembershipCheckout,
  recordMembershipCheckoutCompletion,
  settleMembershipInvoice,
  endMembershipFromSubscription
} from './membership-edge.mjs';

export {
  moneyEdgeError,
  derToPem,
  TOPUP_ECONOMY,
  MEMBERSHIP_ECONOMY,
  MEMBERSHIP_TIERS,
  NODE_MONEY_EDGE_SCHEMA,
  NODE_MONEY_EVENT_SCHEMA,
  NODE_MONEY_CHALLENGE_DOMAIN,
  NODE_MONEY_REQUEST_DOMAIN,
  MONEY_EDGE_EVENT_DOMAIN,
  NODE_MONEY_ENROLLMENT_SCHEMA,
  splitTopupServiceNet
};

export class CloudflareMoneyEdge extends BaseMoneyEdge {
  readiness() {
    return Object.freeze({
      ...super.readiness(),
      membershipEconomy: MEMBERSHIP_ECONOMY,
      membershipTiers: Object.values(MEMBERSHIP_TIERS).map(tier => Object.freeze({ ...tier })),
      membershipBilling: 'monthly-platform-subscription-separate-host-transfer'
    });
  }

  async createMembership(input, raw, signatureHeader) {
    return createMembershipCheckout(this, input, raw, signatureHeader);
  }

  async handleProviderEvent(event) {
    const object = event?.data?.object || {};
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object?.mode === 'subscription' || object?.metadata?.civweave_schema === 'civweave.node-membership.v1') {
        return recordMembershipCheckoutCompletion(this, object);
      }
    }
    if (event.type === 'invoice.paid') return settleMembershipInvoice(this, object, event.id);
    if (event.type === 'customer.subscription.deleted') return endMembershipFromSubscription(this, object, event.id);
    return super.handleProviderEvent(event);
  }
}
