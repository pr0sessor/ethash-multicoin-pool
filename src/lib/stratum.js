const net = require('net')

const Messenger = require('./messenger')
const logger = require('./logger')
const utils = require('./utils')

const config = require('../config')
const httpResponse = ' 200 OK\nContent-Type: text/plain\nContent-Length: 20\n\nMining server online'

function StratumServer (portData, handleMinerData, rmvMiner) {
  function conn (socket) {
    let dataBuffer = ''

    socket.extraNonce = utils.makeNonce(config.stratum.nonceSize)

    socket.setKeepAlive(true)
    socket.setEncoding('utf8')

    let pushMessage = function (method, params) {
      if (!socket.writable) {
        return
      }
      const sendData = JSON.stringify({
        id: null,
        method: method,
        params: params
      }) + '\n'
      socket.write(sendData)
    }

    socket.on('data', function (d) {
      dataBuffer += d
      if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) { // 10KB
        dataBuffer = null
        logger('warn', 'socket', `Excessive packet size from: ${socket.remoteAddress}`)
        socket.destroy()
        return
      }
      if (dataBuffer.indexOf('\n') !== -1) {
        const messages = dataBuffer.split('\n')
        const incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop()
        for (let i = 0; i < messages.length; i++) {
          const message = messages[i]
          if (message.trim() === '') {
            continue
          }
          let jsonData
          try {
            jsonData = JSON.parse(message)
          } catch (e) {
            if (message.indexOf('GET /') === 0 || message.indexOf('POST /') === 0) {
              if (message.indexOf('HTTP/1.1') !== -1) {
                socket.end('HTTP/1.1' + httpResponse)
                break
              } else if (message.indexOf('HTTP/1.0') !== -1) {
                socket.end('HTTP/1.0' + httpResponse)
                break
              }
            }
            logger('error', 'socket', `Malformed message from ${socket.remoteAddress} Message: ${message}`)
            socket.destroy()
            break
          }
          const messenger = new Messenger(socket, jsonData, pushMessage)
          handleMinerData(jsonData, portData, socket, pushMessage, messenger)
        }
        dataBuffer = incomplete
      }
    }).on('error', err => {
      if (err.code !== 'ECONNRESET') {
        logger('error', 'socket', `Socket Error from ${socket.remoteAddress} Error: ${err}`)
      }
    }).on('close', () => {
      pushMessage = function () {}
      if (socket.extraNonce) {
        rmvMiner(socket.extraNonce)
      }
      logger('error', 'stratum', `Miner disconnected ${socket.remoteAddress}`)
    })
  }

  const server = net.createServer(conn)
  server.listen(portData.port, error => {
    if (error) {
      logger('error', 'stratum', `Unable to start stratum server on: ${portData.port} Message: ${error}`)
      return
    }
    logger('info', 'stratum', `Started stratum server on port: ${portData.port}`)
  })

  return server
}

module.exports = StratumServer
