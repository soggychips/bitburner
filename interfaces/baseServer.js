let reservedHomeRam = (ns) => 8;

export default class BaseServer {
  constructor(ns, hostname) {
    this.ns = ns;
    this._id = hostname;
  }

  get id() { return this._id }
  get data() { return this.ns.getServer(this.id) }
  get ip() { return this.data.ip }
  get isHome() { return this.id == "home" }
  get admin() { return this.data.hasAdminRights }
  get cores() { return this.data.cpuCores }
  get connected(){return this.data.isConnectedTo}
  get purchased() { return this.data.purchasedByPlayer && this.id != "home" }
  get power(){return Math.log2(this.ram.max)}
  get org() { return this.data.organizationName }
  get backdoored() { return this.data.backdoorInstalled }
  get ram() {
    return {
      max: this.data.maxRam - (this.data.hostname === "home" ? reservedHomeRam(this.ns) : 0),
      used: this.data.ramUsed,
      free: Math.max(0, this.data.maxRam - this.data.ramUsed - (this.data.hostname === "home" ? reservedHomeRam(this.ns) : 0)), 
      trueMax: this.data.maxRam
    }
  }
  get money() {
    return {
      available: this.data.moneyAvailable,
      max: this.data.moneyMax,
      growth: this.data.serverGrowth
    }
  }
  get ports() {
    return {
      required: this.data.numOpenPortsRequired,
      open: this.data.openPortCount,
      ssh: this.data.sshPortOpen,
      ftp: this.data.ftpPortOpen,
      smtp: this.data.smtpPortOpen,
      http: this.data.httpPortOpen,
      sql: this.data.sqlPortOpen
    }
  }
  get security() {
    return {
      base: this.data.baseDifficulty,
      min: this.data.minDifficulty,
      level: this.data.hackDifficulty
    }
  }
  get isPrepped() {
    return this.security.level == this.security.min && this.money.available == this.money.max
  }

  threadCount(scriptRam){
    return Math.floor(this.ram.free/scriptRam);
  }
}
