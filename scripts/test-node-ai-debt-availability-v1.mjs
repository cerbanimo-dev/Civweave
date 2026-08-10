import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {NodeAiLedger} from '../lib/node-ai-ledger-sqlite-v1.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'cw-node-debt-availability-'));
const ledger=new NodeAiLedger({databasePath:path.join(dir,'node.sqlite'),nodeId:'node:debt-availability',operatorId:'operator:test',platformFeeBps:2000});
try{
  ledger.creditTopUp({userId:'user:test',sourceId:'topup:1',grossCents:1000});
  ledger.reserve({userId:'user:test',reservationId:'reservation:1',serviceId:'general',maxRetailCostCents:700});
  const chargeback=ledger.debitAdjustment({userId:'user:test',sourceId:'chargeback:1',amountCents:500,eventType:'payment.chargeback'});
  assert.equal(chargeback.wallet.balanceCents,700);
  assert.equal(chargeback.wallet.reservedCents,700);
  assert.equal(chargeback.wallet.unreservedCents,0);
  assert.equal(chargeback.wallet.availableCents,0);
  assert.equal(chargeback.wallet.debtCents,200);

  const settled=ledger.settle({userId:'user:test',reservationId:'reservation:1',actualRetailCostCents:346,requestId:'request:1'});
  assert.equal(settled.wallet.balanceCents,354);
  assert.equal(settled.wallet.reservedCents,0);
  assert.equal(settled.wallet.unreservedCents,354,'unreserved funds remain durable and recoverable while debt exists');
  assert.equal(settled.wallet.availableCents,0,'debt must suppress publicly spendable availability');
  assert.equal(settled.wallet.debtCents,200);
  assert.throws(()=>ledger.reserve({userId:'user:test',reservationId:'reservation:2',serviceId:'general',maxRetailCostCents:1}),/unpaid refund or chargeback/);

  const repayment=ledger.creditTopUp({userId:'user:test',sourceId:'topup:2',grossCents:250});
  assert.equal(repayment.wallet.debtCents,0);
  assert.equal(repayment.wallet.balanceCents,404);
  assert.equal(repayment.wallet.unreservedCents,404);
  assert.equal(repayment.wallet.availableCents,404,'spendability returns only after debt is fully repaid');
  console.log(JSON.stringify({ok:true,revision:'node-ai-debt-availability-v1',debtSuppressesSpendableAvailability:true,unreservedValuePreserved:true,repaymentRestoresAvailability:true},null,2));
}finally{
  ledger.close();
  await rm(dir,{recursive:true,force:true});
}
