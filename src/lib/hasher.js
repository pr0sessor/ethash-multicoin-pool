const levelup = require('levelup')
const memdown = require('memdown')
const Ethash = require('node-ethash')
const deasync = require('deasync')

const cacheDB = levelup(memdown())
const getEpoc = new Ethash().getEpoc

const logger = require('./logger')
const utils = require('./utils')

class Hasher {
  constructor (blockNumber) {
    this.blockNumber = blockNumber
    this.currEpoch = 0
    this.nextEpoch = 0
    this.states = { generating: false }
  }

  getEpoc (blockNumber) {
    return getEpoc(blockNumber)
  }

  updateStates (blockNumber) {
    this.blockNumber = blockNumber
    this.runStates()
  }

  runStates () {
    if (this.states.generating) return

    this.currEpoch = this.getEpoc(this.blockNumber)
    this.nextEpoch = this.currEpoch + 1

    if (!this.states[this.currEpoch] && !this.generating) {
      logger('info', 'system', `Calculating state for current epoch #${this.currEpoch}`)
      this.states.generating = true
      const ethash = new Ethash(cacheDB)
      ethash.loadEpoc(this.currEpoch * 30000, st => {
        this.states = this.states || {}
        this.states[this.currEpoch] = ethash
      })
      deasync.loopWhile(() => { return !this.states[this.currEpoch] })
      this.states.generating = false
      logger('info', 'system', `Calculation done, current seed is ${this.states[this.currEpoch].seed.toString('hex')}`)
    }

    if (!this.states[this.nextEpoch] && !this.generating) {
      logger('info', 'system', `Pre-calculating next state for epoch #${this.nextEpoch}`)
      this.states.generating = true
      const ethash = new Ethash(cacheDB)
      ethash.loadEpoc(this.nextEpoch * 30000, st => {
        if (!st || this.states[this.nextEpoch]) return
        this.states = this.states || {}
        this.states[this.nextEpoch] = ethash
      })
      deasync.loopWhile(() => { return !this.states[this.nextEpoch] })
      this.states.generating = false
      logger('info', 'system', `Pre-calculation done, next seed is ${this.states[this.nextEpoch].seed.toString('hex')}`)
    }
  }

  verifyPoW (powHash, nonce) {
    const r = this.states[this.currEpoch].doHash(Buffer.from(utils.rmPreHex(powHash), 'hex'), Buffer.from(utils.rmPreHex(nonce), 'hex'))
    return {
      mix_hash: utils.preHex(r.mix_hash.toString('hex')),
      result: utils.preHex(r.result.toString('hex'))
    }
  }

  isReady () {
    return !this.generating
  }
}

module.exports = Hasher
