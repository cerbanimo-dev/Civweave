# Territory Stewardship execution checklist

The files in this directory are **execution drafts**, not evidence that anyone has signed, accepted, been classified for payroll/tax purposes, or completed payout onboarding.

## Before the resolution is effective as a company act

- Confirm Cerbanimo LLC's exact legal name, state of formation, and current operating agreement.
- Confirm who presently has authority to adopt the written consent for the LLC.
- Insert the authorized person's legal name and formation state.
- Have the resolution reviewed for the Company's actual LLC governance requirements and signed/date it.

## Before an individual Steward receives cash

For each Steward:

- verify legal name and identity separately from their public/professional Civweave name;
- execute the applicable Territory Stewardship Agreement;
- determine worker/payment classification from the actual relationship and work location rather than the contract title;
- obtain the required tax and information-reporting forms;
- complete payment-provider/KYC onboarding for the legally approved recipient or paying entity;
- complete any payroll, withholding, social-insurance, workers' compensation, unemployment, or other mandatory setup that applies;
- only then change the D1 appointment from `pending-signature` / `held-pending-onboarding` to accepted / payout-ready and bind the approved payout account.

Until those steps are complete, the runtime may calculate the Territory Stewardship Share but holds it rather than transferring it.

## Initial drafts

- `2026-08-14-territory-stewardship-resolution.md`
- `agreement-cami-ryn-stormcaller-us.md`
- `agreement-taki-japan.md`
- `agreement-anthony-stematz-breitling-kansas-city-mo.md`
- `agreement-saphirah-pociluyko-los-angeles-ca.md`

The canonical economic implementation is `docs/finance/territory-stewardship-economy-v1.md`.

## Counsel/accounting review notes

The agreements deliberately avoid promising that a Steward is an employee or independent contractor. That question must follow the facts and applicable law. The Japan agreement also avoids promising a direct U.S.-to-individual payment because the appropriate route may depend on the eventual Japanese operating entity, withholding, and reporting setup.

Do not place Social Security numbers, tax identifiers, bank credentials, identity documents, Stripe secrets, or other sensitive onboarding material in this repository.
