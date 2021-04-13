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
      type: BigNumberSchema
    },
    hash: {
      type: String
    },
    datePaid: {
      type: Number
    },
    status: {
      type: String,
      enum: ['paid', 'failed'],
      default: 'paid'
    }
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Payout = mongoose.model('Payout', Schema)

module.exports = Payout
