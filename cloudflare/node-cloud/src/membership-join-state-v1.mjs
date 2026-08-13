export const MEMBERSHIP_JOIN_STATE_SCHEMA='civweave.membership-join-state.v1';
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
export const pendingMembershipKey=(nodeId,userId)=>`pending-membership:${clean(nodeId)}:${clean(userId)}`;
