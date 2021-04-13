const moment = require('moment')

const logger = require('./logger')

const config = require('../config')

const { Hashrate, Miner } = require('../models')

function clearHashrate () {
  logger('info', 'cron', 'Started')
  logger('info', 'cron', 'Clearing hashrate')
  Hashrate.deleteMany({ createdAt: { $lt: moment(Date.now() - (1800 * 1000)).toDate() } }, (err) => {
    if (err) logger('error', 'mongo', err.message)
  })
}

function clearMinersOnlineStatus () {
  logger('info', 'cron', 'Clearing miners online status')
  Miner.updateMany({ lastShare: { $lt: moment().unix() - 600 } }, { status: 'offline' }, (err) => {
    if (err) logger('error', 'mongo', err.message)
  })
}

clearHashrate()
clearMinersOnlineStatus()
setInterval(clearHashrate, config.cron.intervals.hashrate * 1000)
setInterval(clearMinersOnlineStatus, config.cron.intervals.miners * 1000)
