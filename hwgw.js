import BaseServer from "interfaces/baseServer"

const GROW = 0.004;
const HACK = 0.002;
const WEAK = -0.05;

function getAllServers(ns, include_owned = false, root = 'home', found = []) {
	found.push(root);
	for (const server of root == 'home' ? ns.scan(root) : ns.scan(root).slice(1)) getAllServers(ns, include_owned, server, found);
  if (include_owned){
    return found;
  }
	return found.filter(s => s!="home" && !s.includes('pserv'));
}

export function analyze_target(ns, target_name, attacker_name, max_percentage=0.05){
  // finds largest batch against target that the attacker can handle (up to max_percentage passed) and passes that back
  let target = new BaseServer(ns, target_name);
  let target_object = target.data;
  let attacker = new BaseServer(ns, attacker_name);
  let player = ns.getPlayer();
  let maxHackThreads = attacker.threadCount(1.7);
  
  
  let best = {};
  for(let hackThreads=1; hackThreads < maxHackThreads; hackThreads ++){
    // hack
    target_object.moneyAvailable = target.money.max;
    target_object.hackDifficulty = target.security.min;

    let hackPercentPerThread = ns.formulas.hacking.hackPercent(target_object, player);
    let hackAmount = Math.min(hackPercentPerThread * hackThreads, 1) * target.money.max;
    let hackPercentage = Math.min(1, hackPercentPerThread * hackThreads)
    target_object.moneyAvailable -= hackAmount;
    target_object.hackDifficulty += HACK * hackThreads;

    // W1
    let weaken1Threads = Math.ceil((target.security.min - target_object.hackDifficulty) / WEAK);
    target_object.hackDifficulty = target.security.min;

    // G
    let growThreads = ns.formulas.hacking.growThreads(target_object, player, target.money.max, attacker.cores);
    target_object.hackDifficulty += GROW * growThreads;
    target_object.moneyAvailable = target.money.max;

    // W2
    let weaken2Threads = Math.ceil((target.security.min - target_object.hackDifficulty) / WEAK);

    // check if server can handle threads
    let mem_used = ((weaken1Threads + growThreads + weaken2Threads) * 1.75 ) +  (hackThreads * 1.7)
    if (mem_used <= attacker.ram.free){
      best = {hackThreads, growThreads, weaken1Threads, weaken2Threads, attacker: attacker.id}
      if(hackAmount >= target.money.max * max_percentage){
        break
      }
    }else{
      break
    }
  }
  return best;
}



async function prepare(ns, target_name){
  let target = new BaseServer(ns, target_name);
  let home = new BaseServer(ns, 'home');

  while(!target.isPrepped){
    let player = ns.getPlayer()
    let growThreads = ns.formulas.hacking.growThreads(target.data, player, target.money.max, home.cores);
    let weakThreads1 = Math.ceil((target.security.level - target.security.min) * 20);
    let weakThreads2 = Math.ceil((target.security.min - (target.security.min + (growThreads * GROW))) / WEAK);
    
    if(home.threadCount(1.75) >= (growThreads + weakThreads1 + weakThreads2)){
      ns.print(`Enough ram on home to do full prep`)
      if(weakThreads1 > 0){
        ns.exec("bin/bin.weaken.js", "home", weakThreads1, target.id);
      }
      if(growThreads > 0){
        ns.exec("bin/bin.grow.js", "home", growThreads, target.id);
      }
      if(weakThreads2 > 0){
        ns.exec("bin/bin.weaken.js", "home", weakThreads2, target.id);
      }
      await ns.sleep(Math.max(ns.formulas.hacking.weakenTime(target.data, player), ns.formulas.hacking.growTime(target.data, player)))
    }else{
      if(weakThreads1 > 0 && home.threadCount(1.75) > 0){
        ns.exec("bin/bin.weaken.js", "home", Math.min(weakThreads1, home.threadCount(1.75)), target.id);
        await ns.sleep(ns.formulas.hacking.weakenTime(target.data, player))
      }else if(growThreads > 0 && home.threadCount(1.75) > 0){
        ns.exec("bin/bin.grow.js", "home", Math.min(growThreads, home.threadCount(1.75)), target.id);
        await ns.sleep(ns.formulas.hacking.growTime(target.data, player))
      }else if(weakThreads2 > 0 && home.threadCount(1.75) > 0){
        ns.exec("bin/bin.weaken.js", "home", Math.min(weakThreads2, home.threadCount(1.75)), target.id);
        await ns.sleep(ns.formulas.hacking.weakenTime(target.data, player))
      }
    }
    await ns.sleep(20);
  }
  
}

export function find_best_targets(ns){
  let servers = getAllServers(ns, false).map(s => new BaseServer(ns, s)).filter(s => s.admin && s.money.max > 0);
  let player = ns.getPlayer()
  let scores = [];
  for(const server of servers){
    let server_object = ns.getServer(server.id);
    server_object.hackDifficulty = server.security.min;
    scores.push({name: server.id, score: server.money.max / ns.formulas.hacking.weakenTime(server_object, player) * ns.formulas.hacking.hackChance(server_object, player)})
  };

  scores.sort((a,b) => b.score - a.score);
  return scores
}

function find_best_target(ns){
  return find_best_targets(ns)[0];
}

export async function main(ns) {

  const args = ns.flags([["limited", false], ['times', 1], ['help', false]]); // pass --limited if wanting to run a certain number of batches
  if (args.help) {
        ns.tprint("This script run batches against a target given or the best target based on find_best_targets");
        ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME`);
        ns.tprint("Examples:");
        ns.tprint(`> run ${ns.getScriptName()} n00dles`)
        ns.tprint(`> run ${ns.getScriptName()} home --limited --times 10 --tail`)
        return;
    }

  ns.disableLog("ALL")
  ns.clearLog()
  

  let controlled_servers = getAllServers(ns, true).map(s => new BaseServer(ns, s)).filter(s => s.admin || s.purchased);

  controlled_servers.forEach(server => {
    ns.scp(['interfaces/baseServer.js', 'utils.js', 'bin/bin.hack.js', 'bin/bin.weaken.js', 'bin/bin.grow.js'], server.id, 'home');
  })

  controlled_servers.sort((a,b) => b.ram.free - a.ram.free)

  let target_name = args._[0] || find_best_target(ns).name;
  let target = new BaseServer(ns, target_name);

  let the_attacker = args._[1];
  if(the_attacker){
    controlled_servers = controlled_servers.filter(s => s.id == the_attacker)
  }
  

  if(!target.isPrepped){
    // prepare server
    ns.print(`Prepping ${target_name}`)
    await prepare(ns, target_name)
    // return; // TODO remove this
  }else{
    ns.print("No prep needed")
  }
  
  ns.print("Prepped")

  let limited = args.limited;
  let times = 0;
  let done = false;
  while(!done){
    
    // main logic
    for(let attacker of controlled_servers){
      // repopulate controlled servers
      controlled_servers = getAllServers(ns, true).map(s => new BaseServer(ns, s)).filter(s => s.admin || s.purchased);
      if(the_attacker){
        controlled_servers = controlled_servers.filter(s => s.id == the_attacker)
      }
      controlled_servers.forEach(server => {
        ns.scp(['interfaces/baseServer.js', 'utils.js', 'bin/bin.hack.js', 'bin/bin.weaken.js', 'bin/bin.grow.js'], server.id, 'home');
      })
      controlled_servers.sort((a,b) => b.ram.free - a.ram.free)

      times = 0;
      
      let batch = analyze_target(ns, target_name, attacker.id)
      if(Object.keys(batch) == 0){
        // ns.print(`Skipping ${attacker.id}`)
        continue;
      }
      while(Object.keys(batch).length > 0){
        
        // exit condition
        if(limited){
          times ++;
          if(times > args.times){
            break
          }
        }

        
        let player = ns.getPlayer();
        let hackTime = ns.formulas.hacking.hackTime(target.data, player); 
        let weakenTime = ns.formulas.hacking.weakenTime(target.data, player);
        let growTime = ns.formulas.hacking.growTime(target.data, player);

        let next_landing = weakenTime + 3000 + Date.now();    

        ns.exec('bin/bin.hack.js', attacker.id, batch.hackThreads, target.id, hackTime, next_landing, 'H', attacker.id);

        ns.exec('bin/bin.weaken.js', attacker.id, batch.weaken1Threads, target.id, weakenTime, next_landing + 40, 'W1', attacker.id);

        ns.exec('bin/bin.grow.js', attacker.id, batch.growThreads, target.id, growTime, next_landing + 80, 'G__', attacker.id);

        ns.exec('bin/bin.weaken.js', attacker.id, batch.weaken2Threads, target.id, weakenTime, next_landing + 120, 'W2__', attacker.id);

        
        await ns.sleep(150)
        
        batch = analyze_target(ns, target_name, attacker.id)
      }

    }
    await ns.sleep(25)
    if(args.limited){
      done = true
    }
  }

}
