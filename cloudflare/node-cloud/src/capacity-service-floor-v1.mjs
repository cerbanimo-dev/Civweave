export function preservesServiceFloor({dailyCeilingNeurons=0,memberCount=0}={}, {burstReserveBps=1000,survivalFloorNeuronsPerDay=25}={}){
  const ceiling=Math.max(0,Number(dailyCeilingNeurons)||0),members=Math.max(0,Number(memberCount)||0)+1;
  const pool=Math.floor(ceiling*(10000-Math.max(0,Math.min(10000,Number(burstReserveBps)||0)))/10000);
  return Math.floor(pool/Math.max(1,members))>=Math.max(1,Number(survivalFloorNeuronsPerDay)||25);
}
