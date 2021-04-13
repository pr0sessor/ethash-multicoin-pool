const moment = require('moment')
const bignum = require('bignum')

const Upstream = require('./upstream')
const config = require('../config')

const { Account, Reward, Miner, Block, Hashrate, Payout, Candidate } = require('../models')

const upstreams = []

Object.keys(config.stratum.coins).forEach(coin => {
  upstreams[coin] = new Upstream(config.stratum.coins[coin].upstream)
})

const networkStats = async (coin) => {
  const block = await upstreams[coin].getBlockByNumber('latest')
  const difficulty = block.difficulty
  return {
    height: block.number,
    difficulty,
    hashrate: parseInt(difficulty / config.stratum.coins[coin].blockTime)
  }
}

const getPoolStats = async (coin, cb) => {
  const stats = {
    hashrate: 0,
    miners: 0,
    fee: config.unlocker.fee,
    soloFee: config.unlocker.soloFee,
    lastBlockFound: 0,
    network: null,
    payout: {
      threshold: config.payout.threshold,
      interval: config.payout.interval
    }
  }
  // network stats
  stats.network = await networkStats(coin)

  // pool hashrate
  const dbShare = await Hashrate.find({ coin, createdAt: { $gt: new Date(Date.now() - (600 * 1000)) } })
  if (dbShare) {
    let totalShares = 0
    dbShare.forEach((share) => {
      totalShares += Number(share.shares)
    })
    stats.hashrate = parseInt(totalShares / 600)
  }

  // online miners
  const dbMiner = await Miner.find({ coin, status: 'online' })
  if (dbMiner) {
    stats.miners = dbMiner.length
  }

  // last block
  const block = await Block.findOne({ coin }, null, { sort: { createdAt: -1 } })
  if (block) {
    stats.lastBlockFound = moment(block.createdAt).unix()
  }
  cb(stats)
}

const getMinerStats = async (coin, address, cb) => {
  const stats = {
    address: '',
    immature: 0,
    pending: 0,
    paid: 0,
    hashrate: 0,
    blocksFound: 0,
    miners: [],
    payments: []

  }

  if (!address) return cb(new Error('Not found'))

  stats.address = address

  // Balance
  const dbRewards = await Reward.find({ coin, address })
  if (!dbRewards) return cb(new Error('Not found'))
  let immature = 0
  let pending = 0
  dbRewards.forEach(reward => {
    if (reward.status === 'immature') immature += Number(reward.amount)
    if (reward.status === 'pending') pending += Number(reward.amount)
  })
  stats.immature = bignum(immature).toString()
  stats.pending = bignum(pending).toString()

  const dbAccount = await Account.findOne({ coin, address })
  if (dbAccount) {
    stats.paid = bignum(dbAccount.paid).toString()
  }

  // Hashrate
  const dbShare = await Hashrate.find({ coin, createdAt: { $gt: new Date(Date.now() - (600 * 1000)) }, address })
  if (dbShare) {
    let totalShares = 0
    dbShare.forEach(share => {
      totalShares += Number(share.shares)
    })
    stats.hashrate = parseInt(totalShares / 600)
  }

  // Blocks
  const blockCount = await Block.countDocuments({ coin, address, status: { $ne: 'orphan' } })
  if (blockCount) {
    stats.blocksFound = blockCount
  }

  // Miners
  const dbMiner = await Miner.find({ coin, address, status: 'online' })
  if (dbMiner) {
    stats.miners = await Promise.all(dbMiner.map(async miner => {
      const dbShare = await Hashrate.find({ coin, createdAt: { $gt: new Date(Date.now() - (600 * 1000)) }, address, workerName: miner.workerName })
      let totalShares = 0
      if (dbShare) {
        dbShare.forEach(share => {
          totalShares += Number(share.shares)
        })
      }
      return {
        hashrate: parseInt(totalShares / 600),
        shares: miner.shares,
        name: miner.workerName,
        lastShare: miner.lastShare
      }
    }))
  }

  // Payments
  const dbPayment = await Payout.find({ coin, address }, null, { sort: { datePaid: -1 }, limit: 50 })
  if (dbPayment) {
    stats.payments = dbPayment.map(payment => {
      return {
        amount: payment.amount,
        datePaid: payment.datePaid,
        hash: payment.hash
      }
    })
  }
  cb(null, stats)
}

const getPoolBlocks = async (coin, cb) => {
  let candidates = await Candidate.find({ coin }, null, { sort: { createdAt: -1 } })
  candidates = candidates.map(block => {
    return {
      number: block.number,
      solo: block.solo,
      reward: block.reward,
      totalShares: block.totalShares,
      status: 'pending',
      miner: block.address,
      found: block.createdAt
    }
  })
  let blocks = await Block.find({ coin, status: { $ne: 'orphan' } }, null, { sort: { createdAt: -1 }, limit: (50 - candidates.length) })
  blocks = blocks.map(block => {
    return {
      number: block.number,
      solo: block.solo,
      reward: block.reward,
      totalShares: block.totalShares,
      difficulty: block.difficulty,
      status: block.status,
      miner: block.address,
      hash: block.hash,
      uncle: block.type === 'uncle',
      found: block.createdAt
    }
  })
  const pending = candidates.length
  const immature = await Block.countDocuments({ coin, status: 'immature' })
  const unlocked = await Block.countDocuments({ coin, status: 'unlocked' })
  let allBlocks = [...candidates, ...blocks]
  allBlocks = allBlocks.sort((a, b) => Number(b.number) - Number(a.number))
  const res = { pending, immature, unlocked, result: allBlocks }
  cb(res)
}

const getPoolPayments = async (coin, cb) => {
  const payments = await Payout.find({ coin, status: 'paid' }, null, { sort: { datePaid: -1 }, limit: 50 })
  cb(payments)
}

const getPoolMiners = async (coin, cb) => {
  const miners = await Miner.find({ coin })
  const users = []
  miners.forEach(miner => {
    if (!users.includes(miner.address)) users.push(miner.address)
  })
  let list = []
  if (users) {
    list = await Promise.all(users.map(async address => {
      const tempUser = {
        address: '',
        hashrate: 0,
        miners: 0,
        lastShare: null,
        status: 'offline'
      }
      tempUser.address = address
      const dbMiner = await Miner.find({ coin, address })
      if (dbMiner) {
        const tempMiners = await Promise.all(dbMiner.map(async miner => {
          const dbShare = await Hashrate.find({ coin, createdAt: { $gt: new Date(Date.now() - (600 * 1000)) }, address, workerName: miner.workerName })
          let totalShares = 0
          if (dbShare) {
            dbShare.forEach(share => {
              totalShares += Number(share.shares)
            })
          }
          return {
            hashrate: parseInt(totalShares / 600),
            lastShare: (miner.lastShare ? moment(miner.lastShare * 1000).toDate() : null),
            status: miner.status
          }
        }))
        if (tempMiners.length > 0) {
          tempUser.miners = tempMiners.filter(miner => miner.status === 'online').length
          tempUser.hashrate = tempMiners.reduce((a, b) => a + (b.hashrate || 0), 0)
          tempUser.lastShare = (tempMiners.length > 0 ? tempMiners.sort((a, b) => moment(b.lastShare).unix() - moment(a.lastShare).unix())[0].lastShare : null)
          tempUser.status = (tempMiners.filter(miner => miner.status === 'online').length > 0 ? 'online' : 'offline')
        }
        return tempUser
      }
    }))
  }
  cb(list)
}

const getPoolCoins = (cb) => {
  const coins = Object.keys(config.stratum.coins).map(coin => {
    return {
      coin,
      name: config.stratum.coins[coin].name,
      symbol: config.stratum.coins[coin].symbol,
      blockTime: config.stratum.coins[coin].blockTime,
      networkId: config.stratum.coins[coin].networkId,
      ports: config.stratum.coins[coin].ports
    }
  })
  cb(coins)
}

module.exports = {
  networkStats,
  getPoolStats,
  getMinerStats,
  getPoolBlocks,
  getPoolPayments,
  getPoolMiners,
  getPoolCoins
}
