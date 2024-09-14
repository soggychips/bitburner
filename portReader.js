/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.clearLog()
  ns.tail()
  let portNum = ns.args[0] ?? 69;
  ns.clearPort(portNum)
  while(true){
    await ns.nextPortWrite(portNum);
    let data = ns.readPort(portNum);
    if(data != '\n'){
      ns.write("logs/batch_data.txt", data, 'a');
      ns.write("logs/batch_data.txt", "\n", "a")
      
    }
    
    ns.print(data)
  }
}
