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
    number: {
      type: Number
    },
    nonce: {
      type: String
    },
    hash: {
      type: String
    },
    solo: {
      type: Boolean,
      default: false
    },
    reward: {
      type: BigNumberSchema,
      default: '0'
    },
    minerReward: {
      type: BigNumberSchema,
      default: '0'
    },
    fee: {
      type: BigNumberSchema,
      default: '0'
    },
    totalShares: {
      type: BigNumberSchema,
      default: '0'
    },
    round: [{
      address: { type: String },
      difficulty: { type: BigNumberSchema }
    }],
    difficulty: {
      type: BigNumberSchema,
      default: '0'
    },
    type: {
      type: String,
      enum: ['main', 'uncle'],
      default: 'main'
    },
    status: {
      type: String,
      enum: ['immature', 'unlocked', 'orphan'],
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

const Block = mongoose.model('Block', Schema)

module.exports = Block
