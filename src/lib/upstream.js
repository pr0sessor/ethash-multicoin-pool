const Web3 = require('web3')

const utils = require('./utils')

class Upstream {
  constructor (url) {
    this.eth = new Web3(url).eth
  }

  getBlockNumber (callback) {
    this.eth.getBlock('latest')
      .then(block => callback(block.number))
      .catch(() => callback(null))
  }

  getBlockByNumber (block, callback) {
    this.eth.getBlock(block)
      .then(callback)
      .catch(() => callback(null))
  }

  getWork (callback) {
    this.eth.getWork()
      .then(callback)
      .catch((e) => {
        console.log(e)
        callback(null)
      })
  }

  submitWork (nonce, powHash, mixHash, callback) {
    this.eth.submitWork(utils.preHex(nonce), utils.preHex(powHash), utils.preHex(mixHash))
      .then(callback)
      .catch((e) => {
        console.log(e)
        callback(null)
      })
  }

  sendTransaction (tx, privateKey, callback) {
    this.eth.accounts.signTransaction(tx, privateKey)
      .then(txSigned =>
        this.eth.sendSignedTransaction(txSigned.rawTransaction, (err, hash) => {
          if (err) {
            console.log(err)
            return callback(null)
          }
          callback(hash)
        }))
      .catch((e) => {
        console.log(e)
        callback(null)
      })
  }

  getGasPrice (callback) {
    this.eth.getGasPrice()
      .then(price => callback(price))
      .catch((e) => {
        console.log(e)
        callback(null)
      })
  }

  getTransactionCount (address, callback) {
    this.eth.getTransactionCount(address, 'pending')
      .then(count => callback(count))
      .catch((e) => {
        console.log(e)
        callback(null)
      })
  }
}

module.exports = Upstream
