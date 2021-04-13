class Messenger {
  constructor (socket, jsonData, pushMessage) {
    this.socket = socket
    this.jsonData = jsonData
    this.pushMessage = pushMessage
  }

  sendReplyEP (error, result) {
    if (!this.socket.writable) return
    const sendData = JSON.stringify({
      id: this.jsonData.id,
      error: error ? { code: -1, message: error } : null,
      result: !error ? result : null
    }) + '\n'
    this.socket.write(sendData)
  }

  sendReplyES (error, result) {
    if (!this.socket.writable) return
    const sendData = JSON.stringify({
      id: this.jsonData.id,
      error: error ? { code: -1, message: error } : null,
      result: !error ? result : null
    }) + '\n'
    this.socket.write(sendData)
  }
}

module.exports = Messenger
