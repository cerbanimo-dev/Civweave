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
  SHARED_DOMAIN_HOSTING_SCHEMA,
  sharedDomainHostingReadiness,
  reconcileSharedDomainHostingRenewal,
  settleSharedDomainHostingInvoice
} from './shared-domain-billing.mjs';
import {
  CERBANIMO_COMMERCE_SCHEMA,
  CERBANIMO_COMMERCE_FEE_BPS,
  settleCommerceCheckout,
  handleCommerceRefund,
  handleCommerceDispute,
  restoreCommerceDisputeTransfers
} from './commerce-edge.mjs';
import {
  FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
  settleFellowFareServiceFee,
  refundFellowFareServiceFee
} from './fellowfare-service-fee-v1.mjs';
import {
  FELLOWFARE_DEFAULT_SERVICE_FEE_BPS,
  FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS,
  FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS
} from './fellowfare-direct-commerce-v1.mjs';

export {
  moneyEdgeError,
  derToPem,
  TOPUP_ECONOMY,
  MEMBERSHIP_ECONOMY,
  MEMBERSHIP_TIERS,
  SHARED_DOMAIN_HOSTING_SCHEMA,
  sharedDomainHostingReadiness,
  CERBANIMO_COMMERCE_SCHEMA,
  CERBANIMO_COMMERCE_FEE_BPS,
  FELLOWFARE_SERVICE_FEE_SETTLEMENT_SCHEMA,
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
      sharedDomainHosting: sharedDomainHostingReadiness(this.env),
      commerce: Object.freeze({
        mode: 'fellowfare-split-boundary-v2',
        legacyMarketplaceCheckoutEnabled: false,
        legacyMarketplaceRecipientOnboardingEnabled: false,
        goodsPaymentMode: 'seller-direct-outside-platform',
        serviceLearningTokenMode: 'acorn-button-fulfillment-burn',
        serviceLearningUsdMode: 'stripe-connect-direct-charge',
        serviceLearningMerchantOfRecord: 'connected-provider',
        serviceLearningPlatformFeeMode: 'application-fee',
        serviceLearningDefaultPlatformFeeBps: FELLOWFARE_DEFAULT_SERVICE_FEE_BPS,
        serviceLearningApplicationFeeSplit: '50-host-steward-50-cerbanimo',
        serviceLearningHostStewardShareBpsOfFee: FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS,
        serviceLearningCerbanimoShareBpsOfFee: FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS,
        platformCollectsGrossSellerPayment: false,
        platformRoutesSellerProceeds: false,
        legacyLifecycleHandling: true,
        note: 'Physical goods remain seller-direct. Services, learning, and tutoring may use fulfillment burn and/or provider-owned Stripe direct charges with a 5% FellowFare application fee split equally between the facilitating Hub Steward and Cerbanimo. Legacy platform-charge marketplace records remain unwind-only.'
      })
    });
  }

  async createMembership(input, raw, signatureHeader) {
    return createMembershipCheckout(this, input, raw, signatureHeader);
  }

  async handleProviderEvent(event) {
    const object = event?.data?.object || {};
    if (event.type === 'application_fee.created') return settleFellowFareServiceFee(this, object);
    if (event.type === 'application_fee.refunded') return refundFellowFareServiceFee(this, object);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object?.metadata?.civweave_schema === CERBANIMO_COMMERCE_SCHEMA) {
        return settleCommerceCheckout(this, object, event.id);
      }
      if (object?.metadata?.civweave_schema === SHARED_DOMAIN_HOSTING_SCHEMA) {
        return { applied: false, pendingInvoice: true, schema: SHARED_DOMAIN_HOSTING_SCHEMA, checkoutSessionId: object.id };
      }
      if (object?.mode === 'subscription' || object?.metadata?.civweave_schema === 'civweave.node-membership.v1') {
        return recordMembershipCheckoutCompletion(this, object);
      }
    }
    if (event.type === 'invoice.upcoming') {
      const meta = object?.parent?.type === 'subscription_details' ? object.parent.subscription_details?.metadata || {} : {};
      if (meta.civweave_schema === SHARED_DOMAIN_HOSTING_SCHEMA) return reconcileSharedDomainHostingRenewal(this, object);
    }
    if (event.type === 'invoice.paid') {
      const meta = object?.parent?.type === 'subscription_details' ? object.parent.subscription_details?.metadata || {} : {};
      if (meta.civweave_schema === SHARED_DOMAIN_HOSTING_SCHEMA) return settleSharedDomainHostingInvoice(this, object);
      return settleMembershipInvoice(this, object, event.id);
    }
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