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
import {
  CERBANIMO_COMMERCE_SCHEMA,
  CERBANIMO_COMMERCE_FEE_BPS,
  settleCommerceCheckout,
  handleCommerceRefund,
  handleCommerceDispute,
  restoreCommerceDisputeTransfers
} from './commerce-edge.mjs';

export {
  moneyEdgeError,
  derToPem,
  TOPUP_ECONOMY,
  MEMBERSHIP_ECONOMY,
  MEMBERSHIP_TIERS,
  CERBANIMO_COMMERCE_SCHEMA,
  CERBANIMO_COMMERCE_FEE_BPS,
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
      membershipBilling: 'monthly-platform-subscription-separate-host-transfer',
      commerce: Object.freeze({
        accountModel: 'accounts-v2-marketplace-recipient',
        chargePattern: 'platform-charge-separate-transfers',
        splitFeeBps: CERBANIMO_COMMERCE_FEE_BPS,
        splitFeePlacement: 'on-top-of-listed-price',
        contributorPayoutBase: 'full-listed-price',
        settlementTiming: 'immediate-after-paid-checkout',
        annualPoolEligible: false
      })
    });
  }

  async createMembership(input, raw, signatureHeader) {
    return createMembershipCheckout(this, input, raw, signatureHeader);
  }

  async handleProviderEvent(event) {
    const object = event?.data?.object || {};
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object?.metadata?.civweave_schema === CERBANIMO_COMMERCE_SCHEMA) {
        return settleCommerceCheckout(this, object, event.id);
      }
      if (object?.mode === 'subscription' || object?.metadata?.civweave_schema === 'civweave.node-membership.v1') {
        return recordMembershipCheckoutCompletion(this, object);
      }
    }
    if (event.type === 'invoice.paid') return settleMembershipInvoice(this, object, event.id);
    if (event.type === 'customer.subscription.deleted') return endMembershipFromSubscription(this, object, event.id);
    if (event.type === 'charge.refunded') {
      const commerce = await handleCommerceRefund(this, event, object);
      if (commerce.matched) return commerce;
    }
    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') {
      const commerce = await handleCommerceDispute(this, event, object);
      if (commerce.matched) return commerce;
    }
    if (event.type === 'charge.dispute.funds_reinstated') {
      const commerce = await restoreCommerceDisputeTransfers(this, event, object);
      if (commerce.matched) return commerce;
    }
    return super.handleProviderEvent(event);
  }
}
