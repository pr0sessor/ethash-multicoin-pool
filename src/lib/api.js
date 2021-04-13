const bodyParser = require('body-parser')
const express = require('express')
const fs = require('fs')
const http = require('http')
const https = require('https')
const cors = require('cors')
const SocketIO = require('socket.io')

const catchAsync = require('./catchAsync')
const logger = require('./logger')
const api = require('./apiFunctions')

const config = require('../config')

// API server
const app = express()
app.use(bodyParser.json())
app.use(cors())

// GET
app.get('/:coin/stats', catchAsync(async (req, res) => {
  api.getPoolStats(req.params.coin, (stats) => {
    res.json(stats).end()
  })
}))

app.get('/:coin/accounts/:address', catchAsync(async (req, res) => {
  api.getMinerStats(req.params.coin, req.params.address, (err, stats) => {
    if (err) return res.status(404).json({ error: err.message }).end()
    res.json(stats).end()
  })
}))

app.get('/:coin/blocks', catchAsync(async (req, res) => {
  api.getPoolBlocks(req.params.coin, (blocks) => {
    res.json(blocks).end()
  })
}))

app.get('/:coin/payments', catchAsync(async (req, res) => {
  api.getPoolPayments(req.params.coin, (payments) => {
    res.json(payments.map(payment => {
      return {
        address: payment.address,
        amount: payment.amount,
        hash: payment.hash,
        datePaid: payment.datePaid
      }
    })).end()
  })
}))

app.get('/:coin/miners', catchAsync(async (req, res) => {
  api.getPoolMiners(req.params.coin, (miners) => {
    res.json(miners).end()
  })
}))

app.get('/coins', catchAsync(async (req, res) => {
  api.getPoolCoins(coins => {
    res.json(coins).end()
  })
}))

app.use((err, req, res, next) => {
  if (err) {
    logger('error', 'api', `Error: ${err}`)
    res.status(400).send({ error: err.message })
  }
})

const server = !config.api.ssl
  ? http.createServer(app)
  : https.createServer({
    cert: fs.readFileSync(__dirname + config.api.cert),
    key: fs.readFileSync(__dirname + config.api.key)
  }, app)

// Socket API
const io = SocketIO(server)
io.on('connection', (socket) => {
  socket.on('stats', (coin) => {
    api.getPoolStats(coin, (stats) => {
      socket.emit('stats', stats)
    })
  })
  socket.on('account', (coin, address) => {
    api.getMinerStats(coin, address, (err, stats) => {
      if (err) return socket.emit('account', err)
      socket.emit('account', stats)
    })
  })
  socket.on('blocks', (coin) => {
    api.getPoolBlocks(coin, (blocks) => {
      socket.emit('blocks', blocks)
    })
  })
  socket.on('payments', (coin) => {
    api.getPoolPayments(coin, (payments) => {
      socket.emit('payments', payments.map(payment => {
        return {
          address: payment.address,
          amount: payment.amount,
          hash: payment.hash,
          datePaid: payment.datePaid
        }
      }))
    })
  })
  socket.on('miners', (coin) => {
    api.getPoolMiners(coin, (miners) => {
      socket.emit('miners', miners)
    })
  })
})

server.listen(config.api.port, () => {
  logger('info', 'api', `Started api server on port: ${config.api.port}`)
})
