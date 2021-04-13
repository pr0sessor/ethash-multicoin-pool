const mongoose = require('mongoose')
const BigNumberSchema = require('mongoose-bignumber')
const { toJSON, paginate } = require('./plugins')

const Schema = mongoose.Schema(
  {
    address: {
      type: String,
      trim: true,
      lowercase: true
    },
    coin: {
      type: String
    },
    workerName: {
      type: String,
      trim: true
    },
    shares: {
      type: BigNumberSchema,
      default: '0'
    },
    lastShare: {
      type: Number
    },
    status: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline'
    }
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Miner = mongoose.model('Miner', Schema)

module.exports = Miner
