const async = require('async')
const io = require('socket.io-client')

const Upstream = require('./upstream')
const Hasher = require('./hasher')
const Miner = require('./miner')
const StratumServer = require('./stratum')
const logger = require('./logger')
const utils = require('./utils')

const { STRATUM, PROXY } = require('./constants')

const config = require('../config')

const servers = []

let jobs = []
let hasher = null
const miners = []

const backend = io(`http://${config.backend.host}:${config.backend.port}`)

backend.on('connect_error', () => {
  logger('error', 'backend', 'Connection to backend failed')
  process.exit()
})

const coin = config.coin

const upstream = new Upstream(config.stratum.coins[coin].upstream)

async.forEach(config.stratum.coins[config.coin].ports, (portData, i) => {
  servers[i] = StratumServer(portData, handleMinerData, rmvMiner)
})

function addMiner (miner) {
  miners[miner.extraNonce] = miner
  if (miner.workerName !== 'undefined') logger('info', 'stratum', `Worker Name: ${miner.workerName}`)
  if (miner.difficulty) logger('info', 'stratum', `Miner difficulty fixed to ${miner.difficulty}`)
  backend.emit('miner_connect', {
    coin,
    miner
  }, config.backend.key)
}

function rmvMiner (extraNonce) {
  if (miners[extraNonce]) {
    backend.emit('miner_disconnect', {
      coin,
      miner: miners[extraNonce]
    }, config.backend.key)
    delete miners[extraNonce]
  }
}

function getMiner (extraNonce) {
  return miners[extraNonce]
}

function setJob (work) {
  if (!work) return
  const blockNumber = Number(work[3])
  const jobId = work[0].substr(work[0].length - 8)
  if (jobs.findIndex(job => job.jobId === jobId) !== -1) return
  jobs = jobs.filter(job => job.blockHeight > (blockNumber - config.stratum.maxBackLog))
  jobs.push({ jobId: jobId, powHash: work[0], seedHash: work[1], blockTarget: work[2], blockHeight: blockNumber })
  logger('info', 'stratum', `New block to mine at height ${blockNumber}. Job #${jobId}`)
  broadcastJob()
}

async function refreshJob () {
  const work = await upstream.getWork()
  if (!work) return
  hasher.updateStates(Number(work[3]))
  setJob(work)
}

function getTopJob () {
  return jobs[jobs.length - 1]
}

function findJob (jobId) {
  const index = jobs.findIndex(job => job.jobId === jobId)
  if (index !== -1) {
    return jobs[index]
  }
  return false
}

function makeJobEP (extraNonce) {
  const topJob = getTopJob()
  const miner = getMiner(extraNonce)
  if (!topJob || !miner) {
    return false
  }

  return [
    topJob.powHash,
    topJob.seedHash,
    utils.diffToTarget(miner.difficulty * config.stratum.diffToShare)
  ]
}

function makeJobES (extraNonce) {
  const topJob = getTopJob()
  if (topJob === null) {
    return false
  }

  return [
    extraNonce + topJob.jobId,
    topJob.seedHash.substr(2),
    topJob.powHash.substr(2),
    true
  ]
}

function broadcastJob () {
  Object.keys(miners).forEach(extraNonce => {
    const miner = miners[extraNonce]
    if (!miner) return
    if (miner.type === STRATUM) {
      const jobData = makeJobES(miner.extraNonce)
      if (!miner.socket.writable || !jobData) return
      const sendData = JSON.stringify({
        id: null,
        method: 'mining.notify',
        params: jobData
      }) + '\n'
      miner.socket.write(sendData)
    } else if (miner.type === PROXY) {
      const jobData = makeJobEP(miner.extraNonce)
      if (!jobData) return
      const job = JSON.stringify({
        id: 0,
        jsonrpc: '2.0',
        result: jobData
      }) + '\n'
      if (!miner.socket.writable || !job) return
      miner.socket.write(job)
    }
  })
}

function handleMinerData (jsonData, portData, socket, pushMessage, messenger) {
  if (!jsonData.method || !jsonData.params) {
    messenger.sendReplyEP('Malformed stratum request')
  }
  const { method, params } = jsonData

  const methods = {}
  const miner = getMiner(socket.extraNonce)

  methods.eth_submitLogin = () => {
    let [login, pass, workerName] = params
    if (!login) return messenger.sendReplyEP('Missing login')
    if (!hasher) process.exit()

    let solo = false
    if (pass) {
      solo = pass.includes('solo')
      if (!portData.solo && solo) return messenger.sendReplyEP('Solo mining is not allowed on this port')
    }

    if (login.includes('.')) {
      workerName = login.split('.')[1] || workerName
      login = login.split('.')[0]
    }
    if (!utils.validateAddress(login)) return messenger.sendReplyEP('Invalid address')
    if (!workerName) workerName = 0

    const miner = new Miner(utils.generateUnid(), socket, login, pass, solo, PROXY, workerName, socket.remoteAddress, portData, pushMessage)
    addMiner(miner)
    messenger.sendReplyEP(null, true)
    logger('info', 'stratum', `Proxy ${(miner.solo ? 'Solo miner' : 'Miner')} connected ${miner.address}@${miner.ip} on port ${miner.port} `)
  }

  methods.eth_getWork = () => {
    let job = null
    while (!job) {
      job = makeJobEP(miner.extraNonce)
    }
    messenger.sendReplyEP(null, job)
  }

  methods.eth_submitHashrate = () => messenger.sendReplyEP(null, true)
  methods.eth_submitWork = async () => {
    if (!params || params.length !== 3) return messenger.sendReplyEP('Malformed PoW result', null)
    if (!miner) return messenger.sendReplyEP('Not subscribed', null)
    if (!hasher.isReady()) return messenger.sendReplyEP('Validator is not yet ready', null)
    const job = getTopJob()
    if (job.powHash !== params[1]) return messenger.sendReplyEP('Stale share', null)

    const r = hasher.verifyPoW(params[1], params[0])
    miner.active = true
    miner.updateActivity()

    backend.emit('share', {
      coin,
      miner
    }, config.backend.key)

    logger('success', 'stratum', `Valid share received from ${miner.address}@${miner.ip}`)
    if (parseInt(r.result) <= parseInt(job.blockTarget)) {
      const result = await upstream.submitWork(params[0], job.powHash, r.mix_hash)
      if (result) {
        backend.emit('candidate', {
          number: job.blockHeight,
          nonce: utils.preHex(params[0]),
          coin,
          miner
        }, config.backend.key)
        logger('warn', 'stratum', `Candidate block #${job.blockHeight} was mined by ${miner.address}@${miner.ip}`)
      }
    }
    messenger.sendReplyEP(null, true)
  }

  methods['mining.subscribe'] = () => {
    if (params[1] !== 'EthereumStratum/1.0.0') return messenger.sendReplyES('Unsupported protocol version')
    if (!portData.nicehash) return messenger.sendReplyES('Nicehash is not allowed on this port')

    const subscriptionHash = utils.generateUnid()
    const extraNonce = socket.extraNonce

    messenger.sendReplyES(null, [
      [
        'mining.notify',
        subscriptionHash,
        'EthereumStratum/1.0.0'
      ],
      extraNonce
    ])
  }

  methods['mining.authorize'] = () => {
    let [login, pass, workerName] = params
    if (!login) return messenger.sendReplyES('Missing login')

    let solo = false
    if (pass) {
      solo = pass.includes('solo')
      if (!portData.solo && solo) return messenger.sendReplyEP('Solo mining is not allowed on this port')
    }

    if (login.includes('.')) {
      workerName = login.split('.')[1] || workerName
      login = login.split('.')[0]
    }
    if (!utils.validateAddress(login)) return messenger.sendReplyES('Invalid address')
    if (!workerName) workerName = 0

    const miner = new Miner(utils.generateUnid(), socket, login, pass, solo, STRATUM, workerName, socket.remoteAddress, portData, portData.difficulty, pushMessage)
    addMiner(miner)
    messenger.sendReplyES(null, true)
    pushMessage('mining.set_difficulty', [miner.difficulty / 2])
    pushMessage('mining.notify', makeJobES(miner.extraNonce))
    logger('info', 'stratum', `Stratum ${(miner.solo ? 'Solo miner' : 'Miner')} connected ${miner.address}@${miner.ip} on port ${miner.port} `)
  }

  methods['mining.submit'] = async () => {
    if (!params || params.length !== 3) return messenger.sendReplyES('Malformed PoW result', null)
    if (!miner) return messenger.sendReplyES('Not subscribed', null)
    if (!hasher.isReady()) return messenger.sendReplyES('Validator is not yet ready', null)
    if (params[1].length !== config.nonceSize + 16) return messenger.sendReplyES('Invalid job id', null)
    const jobId = params[1].substr(config.nonceSize)
    const extraNonce = params[1].substr(0, config.nonceSize)

    const job = findJob(jobId)
    if (!job) return messenger.sendReplyES('Job not found', null)

    const r = hasher.verifyPoW(job.powHash, extraNonce + params[2])
    miner.active = true
    miner.updateActivity()

    backend.emit('share', {
      coin,
      miner
    }, config.backend.key)

    logger('success', 'stratum', `Valid share received from ${miner.address}@${miner.ip}`)
    if (parseInt(r.result) <= parseInt(job.blockTarget)) {
      const result = await upstream.submitWork(extraNonce + params[2], job.powHash, r.mix_hash, job.blockHeight)
      if (result) {
        backend.emit('candidate', {
          coin,
          number: job.blockHeight,
          nonce: utils.preHex(extraNonce + params[2]),
          miner
        }, config.backend.key)
        logger('warn', 'stratum', `Candidate block #${job.blockHeight} was mined by ${miner.address}@${miner.ip}`)
      }
    }
    messenger.sendReplyES(null, true)
  }

  methods['mining.extranonce.subscribe'] = () => {
    socket.write(JSON.stringify({
      id: null,
      method: 'mining.set_extranonce',
      params: [
        socket.extraNonce
      ]
    }) + '\n')
  }

  if (!Object.keys(methods).includes(method)) {
    return messenger.sendReplyEP('Unknown stratum method')
  }
  methods[method]()
}

upstream.getWork().then(work => {
  if (!work) {
    logger('error', 'stratum', 'Unable to get work from chain')
    process.exit()
  }
  hasher = new Hasher(Number(work[3]))
  setJob(work)
  setInterval(() => {
    refreshJob()
  }, config.stratum.blockRefreshInterval)
})
