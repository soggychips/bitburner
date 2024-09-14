/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  let runtime = ns.args[1];
  let landTime = ns.args[2];
  let name = ns.args[3] ?? 'Weaken';
  let server_name = ns.args[4];
  
  if(landTime && runtime){
    let delay = landTime - runtime - Date.now();
    if(delay < 0){
      delay = 0
    }
    await ns.weaken(target, {additionalMsec: delay})
  }else{
    await ns.weaken(target);
  }

  const end = Date.now()
  if(landTime){
    ns.writePort(1, `${name} on ${target} ${server_name ? `from ${server_name}` : ''} finished at ${new Date(end).toISOString().slice(-13)} / ${new Date(landTime).toISOString().slice(-13)}=> end-landTime = ${end-landTime}\n`);
  }
}
