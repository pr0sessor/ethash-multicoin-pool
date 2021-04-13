const moment = require('moment')

class Miner {
  constructor (uniqueId, socket, address, pass, solo, type, workerName, ip, portData, pushMessage) {
    this.uniqueId = uniqueId
    this.minerId = `${ip}:${portData.port}`
    this.socket = socket
    this.extraNonce = socket.extraNonce
    this.address = address
    this.pass = pass
    this.solo = (!!solo)
    this.type = type
    this.workerName = workerName
    this.ip = ip
    this.port = portData.port
    this.difficulty = portData.difficulty
    this.pushMessage = pushMessage
    this.active = true
    this.lastActivity = 0
  }

  updateActivity () {
    this.active = true
    this.lastActivity = this.now()
  }

  now () {
    return moment().unix()
  }
}

module.exports = Miner
