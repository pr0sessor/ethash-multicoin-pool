# ethash-multicoin-pool

## What is it?

A multi-coin/port stratum pool for ethash coins.

## Prerequisites

* make
* build-essential

## Features

* Stratum
* Nicehash
* Solo mining
* Multi-port
* Multi-coin
* Extra reward for block miner

## How to setup and run?

```javascript
sudo apt update
sudo apt install make build-essential -y
git clone https://github.com/pr0sessor/ethash-multicoin-pool
cd ethash-multicoin-pool
npm install
node src/init.js <args>
```

## Arguments

* --backend (initializes backend server)
* --stratum (initializes Stratum server)
* --coin  (initializes the coin for stratum server. this must be run together with --stratum. ex. --stratum --coin=ethereum)
* --api (enables API server)
* --unlocker (enables Unlocker)
* --payout (enables Payout)
* --private (passes private key file for sending payout. this must be run together with --payout. ex. --payout --private=/home/private)
* --cron (enables Cron Jobs)

## Example

```javascript
node app --stratum --solo
```
Just like open-ethereum-pool, you can run the features separately as long as they're connected to the same MongoDB.
* 1x instance of Stratum per node (You can have multiple nodes)
* 1x instance of API 
* 1x instance of Unlocker, Payout and Cron Job per pool (You must only run 1 instance of Unlocker, Payout and Cron Job to avoid duplication)

## Requirements

* A fully synced node
* Node.js (10.x)
* MongoDB (4.x)

## Dependencies

* net
* deasync
* memdown
* levelup
* web3
* web3-utils
* node-ethash
* bignum
* mongoose
* moment
* express
* body-parser
* cors
* colors
* socket.io

## Credits
* CryptoManiac: https://github.com/CryptoManiac/node-ethash/
