const mongoose = require('mongoose')

const logger = require('./lib/logger')
const config = require('./config')

mongoose.connect(config.mongoose.url, config.mongoose.options, (err) => {
  if (err) {
    logger('error', 'mongo', 'Error connecting to MongoDB')
    process.exit()
  }
})

mongoose.connection.once('open', function () {
  if (config.backend.enabled) {
    require('./lib/backend.js')
  }
  if (config.stratum.enabled) {
    require('./lib/')
  }
  if (config.unlocker.enabled) {
    require('./lib/unlocker.js')
  }
  if (config.payout.enabled) {
    require('./lib/payout.js')
  }
  if (config.api.enabled) {
    require('./lib/api.js')
  }
  if (config.cron.enabled) {
    require('./lib/cron.js')
  }
})
