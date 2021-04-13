const mongoose = require('mongoose')
const BigNumberSchema = require('mongoose-bignumber')
const { toJSON, paginate } = require('./plugins')

const Schema = mongoose.Schema(
  {
    address: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true
    },
    coin: {
      type: String
    },
    paid: {
      type: BigNumberSchema,
      default: '0'
    }
  },
  {
    timestamps: true
  }
)

// add plugin that converts mongoose to json
Schema.plugin(toJSON)
Schema.plugin(paginate)

const Account = mongoose.model('Account', Schema)

module.exports = Account
