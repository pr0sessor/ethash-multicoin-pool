const moment = require('moment')
const http = require('http').createServer()
const io = require('socket.io')(http)
const bignum = require('bignum')

const Upstream = require('./upstream')
const logger = require('./logger')
const utils = require('./utils')

const config = require('../config')

const upstreams = []

Object.keys(config.stratum.coins).forEach(coin => {
  upstreams[coin] = new Upstream(config.stratum.coins[coin].rpc)
})

const { Account, Miner, Round, Hashrate, Candidate, Reward, Payout } = require('../models')

io.on('connection', (socket) => {
  socket.on('miner_connect', (data, key) => {
    const { miner, coin } = data
    if (key !== config.backend.key) return
    Miner.findOne({ coin, address: miner.address, workerName: miner.workerName }, (err, res) => {
      if (err) return logger('error', 'mongo', err.message)
      if (!res) {
        Miner.create({
          coin,
          address: miner.address,
          workerName: miner.workerName,
          shares: '0',
          lastShare: 0,
          status: 'online'
        })
      } else {
        Object.assign(res, {
          status: 'online'
        }).save()
      }
      Account.findOne({ address: miner.address }, (err2, res2) => {
        if (err2) return logger('error', 'mongo', err2.message)
        if (!res2) {
          Account.create({
            address: miner.address,
            coin,
            paid: 0
          })
        }
      })
    })
  })
  socket.on('miner_disconnect', (data, key) => {
    const { miner, coin } = data
    if (key !== config.backend.key) return
    Miner.findOne({ coin, address: miner.address, workerName: miner.workerName }, (err, res) => {
      if (err) return logger('error', 'mongo', err.message)
      if (res) {
        Object.assign(res, {
          status: 'offline'
        }).save()
      }
    })
  })
  socket.on('share', async (data, key) => {
    const { miner, coin } = data
    if (key !== config.backend.key) return
    Round.create({
      coin,
      address: miner.address,
      workerName: miner.workerName,
      shares: miner.difficulty * config.stratum.diffToShare,
      solo: miner.solo
    })
    Hashrate.create({
      coin,
      address: miner.address,
      workerName: miner.workerName,
      shares: miner.difficulty * config.stratum.diffToShare,
      solo: miner.solo
    })
    Miner.findOne({ coin, address: miner.address, workerName: miner.workerName }, (err, minerDB) => {
      if (err) return logger('err', 'mongo', err.message)
      Object.assign(minerDB, {
        status: 'online',
        lastShare: moment().unix(),
        shares: Number(minerDB.shares) + Number(miner.difficulty * config.stratum.diffToShare)
      }).save()
    })
  })
  socket.on('candidate', (data, key) => {
    const { miner, coin, number, nonce } = data
    if (key !== config.backend.key) return
    Round.find({ coin, solo: miner.solo, createdAt: { $gt: new Date(Date.now() - (config.unlocker.hashrateDuration * 1000)) } }, async (err, res) => {
      if (err) return logger('error', 'mongo', err.message)
      const tmpRound = []
      res.forEach((share) => {
        if (!tmpRound[share.address]) {
          tmpRound[share.address] = Number(share.shares)
        } else {
          tmpRound[share.address] += Number(share.shares)
        }
      })
      const round = []
      let totalShares = 0
      Object.keys(tmpRound).forEach((address) => {
        totalShares += tmpRound[address]
        round.push({ address, shares: tmpRound[address] })
      })
      const block = {
        coin,
        address: miner.address,
        solo: miner.solo,
        number,
        nonce
      }
      Object.assign(block, {
        round,
        totalShares
      })
      await Round.deleteMany({ coin })
      await Candidate.create(block)
    })
  })
  socket.on('immature_update', async (data, key) => {
    if (key !== config.backend.key) return
    const { coin, address, amount, number } = data
    await Reward.create({
      coin,
      address,
      amount,
      number
    })
  })
  socket.on('send_payout', (data, key, id) => {
    if (key !== config.backend.key) return
    const { privateKey, coin, address, amount } = data
    const tx = {
      from: config.stratum.coins[coin].coinAddress,
      to: address,
      value: utils.preHex(bignum(amount).toString(16)),
      gas: utils.preHex(bignum(config.payout.gas).toString(16)),
      gasPrice: utils.preHex(bignum(config.payout.gasPrice).toString(16))
    }
    upstreams[coin].sendTransaction(tx, privateKey, (hash) => {
      if (!hash) {
        return socket.emit('payout_response', {
          id,
          success: false,
          message: `Failed to send ${amount.toString()} to ${address}.`
        })
      }
      Account.findOne({ address }, async (err2, account) => {
        if (err2) {
          return socket.emit('payout_response', {
            id,
            success: false,
            message: err2
          })
        }
        if (!account) {
          Account.create({
            address,
            coin,
            paid: amount
          })
        } else {
          Object.assign(account, {
            paid: bignum(account.paid).add(bignum(amount)).toString()
          }).save()
        }
        await Reward.deleteMany({ address, status: 'pending' })
        await Payout.create({
          address,
          coin,
          amount,
          hash,
          datePaid: moment().unix()
        })
        socket.emit('payout_response', {
          id,
          success: true,
          message: `Sent ${amount.toString()} to ${address}. Hash: ${hash}`
        })
      })
    })
  })
})

http.listen(config.backend.port, config.backend.host, () => {
  logger('info', 'backend', `Backend socket listening to port ${config.backend.port}`)
})
