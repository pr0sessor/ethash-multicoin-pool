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
    solo: {
      type: Boolean,
      default: false
    },
    totalShares: {
      type: BigNumberSchema,
      default: 0
    },
    round: [{
      address: { type: String },
      shares: { type: BigNumberSchema }
    }]
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Candidate = mongoose.model('Candidate', Schema)

module.exports = Candidate
