const async = require('async')
const fs = require('fs')
const io = require('socket.io-client')

const logger = require('./logger')

const config = require('../config')

if (!config.payout.private) {
  logger('error', 'payout', 'Private key file was not set')
  process.exit()
}

if (!fs.existsSync(config.payout.private)) {
  logger('error', 'payout', `${config.payout.private} doesn't exist`)
  process.exit()
}

const backend = io(`http://${config.backend.host}:${config.backend.port}`)

backend.on('connect_error', () => {
  logger('error', 'socket', 'Connection to socket.io server failed')
  process.exit()
})

backend.on('payout_response', res => {
  logger((res.success ? 'success' : 'error'), 'payout', res.message)
})

const privateKey = fs.readFileSync(config.payout.private, 'utf-8').toString().trim()

const { Reward } = require('../models')

function payout () {
  logger('info', 'payout', 'Started')
  async.waterfall([

    // Get all miners with pending balance
    function (callback) {
      Reward.find({ status: 'pending' }, (err, rewards) => {
        if (err) return callback(new Error(`Error trying to get pending rewards from database ${[err]}`))
        if (rewards.length === 0) return callback(new Error('No miners with pending balance'))
        const balances = []
        rewards.forEach(reward => {
          if (!balances[reward.address]) {
            balances[reward.address] = { amount: Number(reward.amount), coin: reward.coin }
          } else {
            balances[reward.address].amount += Number(reward.amount)
          }
        })
        callback(null, balances)
      })
    },

    // Check if payout threshold reached
    function (balances, callback) {
      const payables = []
      Object.keys(balances).forEach(address => {
        if (balances[address].amount >= config.payout.threshold) payables.push({ address, amount: balances[address].amount, coin: balances[address].coin })
      })
      callback(null, payables)
    },

    // Handle payments
    function (payables, callback) {
      if (payables.length === 0) return callback(new Error('No miners reach the payout threshold'))
      payables.forEach((payable) => {
        backend.emit('add_payout', {
          privateKey,
          coin: payable.coin,
          address: payable.address,
          amount: payable.amount
        }, config.backend.key)
      })
      callback(null)
    }
  ], function (err) {
    if (err) logger('warn', 'payout', err.message)
    logger('success', 'payout', 'Finished')
  })
}
payout()
setInterval(payout, config.payout.interval * 1000)
