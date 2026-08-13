# Civweave jurisdiction financial implementation map v1

Status: canonical engineering/compliance screening map. This document is not a legal opinion and does not itself authorize live-money behavior. Jurisdiction rules must be re-verified before activation.

As of: 2026-08-13

## Canonical economic boundary

Physical/community goods remain seller-direct by default. Sellers use saved seller-owned payment methods and collect/remit applicable goods tax. FellowFare does not receive, route, split, escrow, or settle goods-sale proceeds and takes no transaction-specific goods fare under the default architecture.

FellowFare may provide a tax copilot: taxability/rate estimation, seller-facing amount-to-collect, threshold warnings, transaction records, and exports. Services, learning, and tutoring retain their separate provider-owned Stripe direct-charge and/or fulfillment lanes. Cerbanimo/Civweave memberships, compute top-ups, automated digital learning, and other platform-owned digital sales require a separate destination-aware VAT/GST/sales-tax engine.

Unknown, stale, or conflicting jurisdiction state fails closed for platform-facilitated goods payment, goods tax collection, transaction-specific goods fees, and on-platform contract formation where the map requires an external contract.

The financial switch catalog is `config/jurisdiction-financial-features-v1.json`.

## Required financial switches

The platform must be configurable for: seller/buyer/delivery jurisdiction; seller establishment and tax-registration status; goods origin and consignment value; product tax class; cross-border status; terms owner; contract-formation surface; order-acceptance surface; payment collector/authorizer; tax collector/remitter; delivery arranger; refunds/disputes; seller-owned payment methods; external checkout; external contract; classifieds-only behavior; platform-facilitated mode; goods transaction/application/listing/referral/percentage fees; tax copilot; facilitator/deemed-supplier mode; tax registrations; tax-inclusive pricing; exemptions; invoices/credit notes; nexus and low-value-goods thresholds; IOSS/VOEC/LVG/import controls; seller reporting/due diligence/TIN collection; withholding; record retention; jurisdiction exports; membership/compute/digital-service tax; provider-direct service tax; refund tax adjustments; effective dates; future rule activation; mandatory review dates; human approvals; emergency disable; and jurisdiction audit logs.

## United States implementation map

- **Maine:** `external_contract_when_triggered`. Use conservative external-contract/classifieds behavior when FellowFare would otherwise communicate the binding offer/acceptance for an affected taxable transaction.
- **Alabama, Idaho, Massachusetts, Virginia, Washington:** `external_contract_when_triggered`. Broad marketplace definitions require a review of contract formation and platform participation even when FellowFare does not hold seller proceeds.
- **Iowa, Indiana, Illinois, North Carolina, Utah:** `seller_direct_external_payment`. No FellowFare goods gateway, application fee, transaction-specific listing/referral/percentage fee, or platform goods-tax collection without deliberate facilitator review.
- **Rhode Island:** `referrer_reporting`. Preserve seller-direct money flow while enabling referrer/facilitator notice, registration, collection, or reporting workflows when thresholds apply.
- **New York:** `seller_direct_tax_copilot`. Seller collects price and applicable tax through seller-owned payment. Do not enable FellowFare collection of seller receipts or goods tax without deliberate marketplace-provider review.
- **California, Nevada, Texas:** `seller_direct_guardrail`. Re-review if future changes add goods checkout, payment control, goods-tax collection, or transaction-specific fees.
- **Alaska, Arizona, Arkansas, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Kansas, Kentucky, Louisiana, Maryland, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, New Hampshire, New Jersey, New Mexico, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, South Carolina, South Dakota, Tennessee, Vermont, West Virginia, Wisconsin, Wyoming:** `seller_direct` default, subject to ordinary nexus and product-taxability review.

## Global implementation map

### EU 27

Austria, Belgium, Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden: `conditional_external_contract` for affected electronic-interface deemed-supplier transaction classes. Preserve EU marketplace recordkeeping and DAC7 review. Mere listing/advertising/redirect-only behavior is the conservative non-facilitating lane.

### Strict external-contract jurisdictions

Switzerland and Liechtenstein: `external_contract`. Binding goods contract must form outside FellowFare unless platform VAT mode is deliberately approved.

### Conditional low-value/import marketplace controls

United Kingdom: `conditional_external_contract` for affected overseas-seller/imported-goods transactions.

Norway: `conditional_external_contract` for affected VOEC/low-value cross-border goods.

Australia, New Zealand, Singapore: `conditional_external_contract` for affected low-value imported goods.

Malaysia: `conditional_external_contract`, with a hard gate for affected LVG transactions until seller/platform registration and threshold status are resolved.

Chile: `conditional_external_contract` for affected low-value imported goods.

### Platform-control / distribution-platform guardrails

Canada: `conditional_external_contract` where FellowFare would otherwise control essential transaction elements for qualifying goods supplied by non-registered sellers. Maintain GST/HST platform and seller-reporting readiness.

Brazil: `conditional_external_contract` where FellowFare would otherwise control billing, payment, transaction terms, or delivery in a way that creates platform responsibility.

Mexico: `seller_direct_reporting`. Payment custody is not a universal reporting escape; maintain seller information-reporting readiness.

### Seller-direct with payment/withholding/reporting guardrails

Turkey: keep seller-direct and gate platform payment, withholding, and reporting changes.

China: keep seller payments direct; seller identity and transaction-reporting compliance requires dedicated launch review.

India: keep goods consideration seller-direct; review GST TCS and specified-service rules before FellowFare collects consideration.

Vietnam: do not add FellowFare goods payment functionality without review because payment capability can change seller withholding/remittance duties.

Philippines and Indonesia: keep goods proceeds off-platform and gate payment/withholding functionality.

Pakistan and Bangladesh: keep seller-direct and require a fresh launch review before platform payment or transaction fees because e-commerce tax rules are moving quickly.

### Seller-direct plus separate digital-tax review

Iceland, Ukraine; Argentina, Colombia, Costa Rica, Ecuador, Peru, Uruguay; South Korea, Taiwan, Thailand, Cambodia, Laos, Kazakhstan, Uzbekistan, Armenia, Azerbaijan, Georgia, Sri Lanka; United Arab Emirates, Saudi Arabia, Bahrain, Oman, Israel; Kenya, South Africa, Nigeria, Ghana, Tanzania, Uganda, Rwanda, Egypt, Morocco, Tunisia, Mauritius, Côte d’Ivoire, Senegal: physical goods stay seller-direct while digital services/platform-owned sales receive a separate jurisdiction tax treatment.

### Current seller-direct / recheck-before-launch

Hong Kong and Qatar: current screening leaves goods seller-direct for this narrow issue, with a mandatory fresh review before launch.

### Japan future-effective-date rule

Japan: physical goods remain `seller_direct_guardrail` now. Maintain an explicit future-rule switch and re-review by 2027-04-01 for the enacted physical-goods platform changes taking effect 2028-04-01. Current digital-platform consumption-tax rules remain a separate digital-services concern.

### Local-review group

Andorra, Afghanistan, Antigua and Barbuda, Albania, Angola, Bosnia and Herzegovina, Barbados, Burkina Faso, Burundi, Benin, Brunei, Bolivia, Bahamas, Bhutan, Botswana, Belarus, Belize, Democratic Republic of the Congo, Central African Republic, Republic of the Congo, Cameroon, Cuba, Cabo Verde, Djibouti, Dominica, Dominican Republic, Algeria, Eritrea, Ethiopia, Fiji, Micronesia, Gabon, Grenada, Gambia, Guinea, Equatorial Guinea, Guatemala, Guinea-Bissau, Guyana, Honduras, Haiti, Iraq, Iran, Jamaica, Jordan, Kyrgyzstan, Kiribati, Comoros, Saint Kitts and Nevis, North Korea, Kuwait, Lebanon, Saint Lucia, Liberia, Lesotho, Libya, Monaco, Moldova, Montenegro, Madagascar, Marshall Islands, North Macedonia, Mali, Myanmar, Mongolia, Macau, Mauritania, Maldives, Malawi, Mozambique, Namibia, Niger, Nicaragua, Nepal, Nauru, Panama, Papua New Guinea, State of Palestine, Palau, Paraguay, Serbia, Russia, Solomon Islands, Seychelles, Sudan, Sierra Leone, San Marino, Somalia, Suriname, South Sudan, São Tomé and Príncipe, El Salvador, Syria, Eswatini, Chad, Togo, Tajikistan, Timor-Leste, Turkmenistan, Tonga, Trinidad and Tobago, Tuvalu, Vatican City, Saint Vincent and the Grenadines, Venezuela, Vanuatu, Samoa, Kosovo, Yemen, Zambia, Zimbabwe: `local_review`. Keep seller-direct and require fresh local launch review before enabling platform goods payment, goods-tax collection, deemed-supplier/facilitator mode, or transaction-specific goods fees.

## Resolution algorithm

1. Resolve seller establishment, seller tax-registration status, buyer/delivery jurisdiction, goods origin, product class, value/currency, and cross-border status.
2. Resolve who sets transaction terms, where the binding contract forms, where the order is accepted, who authorizes/collects payment, who collects/remits tax, and who arranges delivery.
3. Resolve the country rule. For the United States, also resolve the state rule.
4. Apply transaction-scope triggers such as low-value import, nonresident seller, reporting threshold, payment functionality, or a future effective date.
5. Apply the strictest relevant behavior across seller establishment, goods origin, destination, and state/subdivision.
6. `external_contract` means the final binding order/acceptance happens on a seller-owned surface, not merely that the money is paid externally.
7. Never switch into facilitator, deemed-supplier, or platform-tax behavior unless registrations, tax collection/remittance, filing, exemptions, refunds, recordkeeping, seller documentation/reporting, product tax classification, and human compliance approval are all operational.
8. Persist the policy version and decision inputs for auditability.

## Source anchors for high-impact rules

- EU electronic-interface definition and listing/redirect exclusions: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R2026
- Switzerland platform taxation: https://www.estv.admin.ch/en/vat-registration-for-platform-operators
- Canada qualifying-goods distribution-platform rules: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/charge-collect/sales-good.html
- Malaysia low-value-goods marketplace rules: https://mylvg.customs.gov.my/AboutUs
- Japan platform consumption-tax overview: https://www.nta.go.jp/english/taxes/consumption_tax/05.htm

## Agent invariant

Before changing goods checkout, seller payment methods, application/listing/referral/transaction fees, marketplace tax collection, seller reporting, withholding, or cross-border goods behavior, read this document and `config/jurisdiction-financial-features-v1.json`. If the desired behavior is absent, extend the canonical configuration/map first. Never solve one jurisdiction by silently changing the global economic boundary.
