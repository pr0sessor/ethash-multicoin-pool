const Web3 = require('web3')

const utils = require('./utils')

class Upstream {
  constructor (url) {
    this.eth = new Web3(url).eth
  }

  getBlockNumber () {
    return new Promise((resolve, reject) => {
      this.eth.getBlock('latest', (err, res) => {
        if (err) reject(err)
        resolve(res.number)
      })
    })
  }

  getBlockByNumber (block) {
    return new Promise((resolve, reject) => {
      this.eth.getBlock(block, (err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  getWork () {
    return new Promise((resolve, reject) => {
      this.eth.getWork((err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  submitWork (nonce, powHash, mixHash) {
    return new Promise((resolve, reject) => {
      this.eth.submitWork(utils.preHex(nonce), utils.preHex(powHash), utils.preHex(mixHash), (err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  signTransaction (tx, privateKey) {
    return new Promise((resolve, reject) => {
      this.eth.accounts.signTransaction(tx, privateKey, (err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  sendSignedTransaction (txRaw) {
    return new Promise((resolve, reject) => {
      this.eth.sendSignedTransaction(txRaw, (err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  getGasPrice () {
    return new Promise((resolve, reject) => {
      this.eth.getGasPrice((err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }

  getTransactionCount (address) {
    return new Promise((resolve, reject) => {
      this.eth.getTransactionCount(address, 'pending', (err, res) => {
        if (err) reject(err)
        resolve(res)
      })
    })
  }
}

module.exports = Upstream
