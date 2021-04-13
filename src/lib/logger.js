const clc = require('cli-color')
const moment = require('moment')

const severityMap = {
  info: clc.cyan,
  warn: clc.yellow,
  error: clc.red,
  success: clc.green,
  main: clc.magenta
}

const logSender = {
  system: 'System',
  process: 'Process',
  stratum: 'Stratum',
  nicehash: 'Nicehash',
  upstream: 'Upstream',
  unlocker: 'Unlocker',
  payout: 'Payout',
  mongo: 'MongoDB',
  backend: 'Backend',
  cron: 'Cron Job',
  api: 'API Server'
}

module.exports = (level, sender, msg) => {
  console.log(clc.blue(moment().format('LTS')) + ' ' + severityMap[level](`[${logSender[sender]}]`) + ' ' + clc.white.bold(msg))
}
