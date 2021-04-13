const config = require('../config.json')

const args = {
  backend: false,
  stratum: false,
  unlocker: false,
  payout: false,
  api: false,
  cron: false,
  coin: '',
  private: ''
}

process.argv.forEach(function (val) {
  if (val.startsWith('--backend')) args.backend = true
  if (val.startsWith('--stratum')) args.stratum = true
  if (val.startsWith('--unlocker')) args.unlocker = true
  if (val.startsWith('--payout')) args.payout = true
  if (val.startsWith('--api')) args.api = true
  if (val.startsWith('--cron')) args.cron = true
  if (val.startsWith('--coin')) args.coin = val.split('=')[1]
  if (val.startsWith('--private')) args.private = val.split('=')[1]
})

if (args.backend) config.backend.enabled = args.backend
if (args.stratum) config.stratum.enabled = args.stratum
if (args.unlocker) config.unlocker.enabled = args.unlocker
if (args.payout) config.payout.enabled = args.payout
if (args.api) config.api.enabled = args.api
if (args.cron) config.cron.enabled = args.cron
if (args.coin) config.coin = args.coin
if (args.private) config.payout.private = args.private

module.exports = config
