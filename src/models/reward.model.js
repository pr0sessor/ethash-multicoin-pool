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
    amount: {
      type: BigNumberSchema,
      default: '0'
    },
    number: {
      type: Number
    },
    status: {
      type: String,
      enum: ['immature', 'pending'],
      default: 'immature'
    }
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Reward = mongoose.model('Reward', Schema)

module.exports = Reward
