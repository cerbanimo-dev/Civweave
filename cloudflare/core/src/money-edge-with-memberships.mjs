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
  refundFellowFareServiceFee,
  retryPendingFellowFareServiceFees
} from './fellowfare-service-fee-v1.mjs';
import {
  FELLOWFARE_DEFAULT_SERVICE_FEE_BPS,
  FELLOWFARE_SERVICE_FEE_HOST_SHARE_BPS,
  FELLOWFARE_SERVICE_FEE_CERBANIMO_SHARE_BPS
} from './fellowfare-direct-commerce-v1.mjs';
import {
  TERRITORY_STEWARDSHIP_SCHEMA,
  TERRITORY_SETTLEMENT_SCHEMA,
  TERRITORY_STEWARDSHIP_POLICY,
  splitExistingCerbanimoShare,
  publicTerritoryRegistry,
  assignNodeTerritory,
  settleTerritoryForTopup,
  reverseTerritoryForTopup,
  settleTerritoryForMembership,
  settleTerritoryForFellowFareFee,
  reverseTerritoryForFellowFareFee,
  retryPendingTerritoryShares
} from './territory-stewardship-v1.mjs';

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
  TERRITORY_STEWARDSHIP_SCHEMA,
  TERRITORY_SETTLEMENT_SCHEMA,
  TERRITORY_STEWARDSHIP_POLICY,
  NODE_MONEY_EDGE_SCHEMA,
  NODE_MONEY_EVENT_SCHEMA,
  NODE_MONEY_CHALLENGE_DOMAIN,
  NODE_MONEY_REQUEST_DOMAIN,
  MONEY_EDGE_EVENT_DOMAIN,
  NODE_MONEY_ENROLLMENT_SCHEMA,
  splitTopupServiceNet,
  splitExistingCerbanimoShare
};

export class CloudflareMoneyEdge extends BaseMoneyEdge {
  readiness() {
    return Object.freeze({
      ...super.readiness(),
      membershipEconomy: MEMBERSHIP_ECONOMY,
      membershipTiers: Object.values(MEMBERSHIP_TIERS).map(tier => Object.freeze({ ...tier })),
      membershipBilling: 'monthly-platform-subscription-separate-host-transfer',
      sharedDomainHosting: sharedDomainHostingReadiness(this.env),
      territoryStewardship: Object.freeze({
        schema: TERRITORY_STEWARDSHIP_SCHEMA,
        policy: TERRITORY_STEWARDSHIP_POLICY,
        sourceBoundary: 'existing-cerbanimo-share-only',
        hostNodeStewardCutChanged: false,
        providerCutChanged: false,
        systemReserveChanged: false,
        payoutBehavior: 'accrue-to-office-hold-until-agreement-and-payout-onboarding'
      }),
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
        serviceLearningCerbanimoSecondStageSplit: '50-cerbanimo-global-50-territory-stewardship',
        serviceLearningHostSettlement: 'application-fee-event-plus-balance-available-retry',
        territorySettlement: 'office-linked-transfer-or-territory-reserve',
        platformCollectsGrossSellerPayment: false,
        platformRoutesSellerProceeds: false,
        legacyLifecycleHandling: true,
        note: 'Physical goods remain seller-direct. Services, learning, and tutoring may use fulfillment burn and/or provider-owned Stripe direct charges. The 5% FellowFare fee still gives half to the facilitating Host Steward. Only the pre-existing Cerbanimo half is subdivided equally between Cerbanimo Global and the applicable Territory Stewardship office.'
      })
    });
  }

  async createMembership(input, raw, signatureHeader) {
    return createMembershipCheckout(this, input, raw, signatureHeader);
  }

  async territoryRegistry() {
    return publicTerritoryRegistry(this);
  }

  async setNodeTerritory(input, raw, signatureHeader) {
    return assignNodeTerritory(this, input, raw, signatureHeader);
  }

  async handleProviderEvent(event) {
    const object = event?.data?.object || {};

    if (event.type === 'application_fee.created') {
      const result = await settleFellowFareServiceFee(this, object);
      const applicationFeeId = result?.settlement?.applicationFeeId || object?.id;
      const territory = result?.applied && applicationFeeId ? await settleTerritoryForFellowFareFee(this, applicationFeeId) : null;
      return territory ? { ...result, territory } : result;
    }

    if (event.type === 'application_fee.refunded') {
      const result = await refundFellowFareServiceFee(this, object);
      const applicationFeeId = result?.settlement?.applicationFeeId || object?.id;
      const refundedFeeCents = Number(result?.settlement?.refundedFeeCents ?? object?.amount_refunded ?? 0);
      const territory = result?.applied && applicationFeeId
        ? await reverseTerritoryForFellowFareFee(this, applicationFeeId, refundedFeeCents, event.id)
        : null;
      return territory ? { ...result, territory } : result;
    }

    if (event.type === 'balance.available') {
      const fellowFare = await retryPendingFellowFareServiceFees(this);
      const territory = await retryPendingTerritoryShares(this);
      return Object.freeze({ applied: true, fellowFare, territory });
    }

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
      const result = await settleMembershipInvoice(this, object, event.id);
      const invoiceId = result?.cycle?.invoiceId || object?.id;
      const territory = result?.applied && !result?.ignored && invoiceId ? await settleTerritoryForMembership(this, invoiceId) : null;
      return territory ? { ...result, territory } : result;
    }

    if (event.type === 'customer.subscription.deleted') return endMembershipFromSubscription(this, object, event.id);

    if (event.type === 'charge.refunded') {
      const commerce = await handleCommerceRefund(this, event, object);
      if (commerce.matched) return commerce;
      const result = await super.handleProviderEvent(event);
      const topupId = result?.topup?.topupId;
      if (!result?.applied || !topupId) return result;
      const territory = await reverseTerritoryForTopup(this, topupId, Number(object?.amount_refunded || 0), 'refund', event.id);
      return { ...result, territory };
    }

    if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.funds_withdrawn') {
      const commerce = await handleCommerceDispute(this, event, object);
      if (commerce.matched) return commerce;
      const result = await super.handleProviderEvent(event);
      const topupId = result?.topup?.topupId;
      if (!result?.applied || !topupId) return result;
      const territory = await reverseTerritoryForTopup(this, topupId, Number(object?.amount || 0), 'dispute', event.id);
      return { ...result, territory };
    }

    if (event.type === 'charge.dispute.funds_reinstated') {
      const commerce = await restoreCommerceDisputeTransfers(this, event, object);
      if (commerce.matched) return commerce;
    }

    const result = await super.handleProviderEvent(event);
    if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && result?.topup?.topupId) {
      const territory = await settleTerritoryForTopup(this, result.topup.topupId);
      return { ...result, territory };
    }
    return result;
  }
}
