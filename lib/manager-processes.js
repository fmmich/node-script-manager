var childProcess = require('child_process')
var path = require('path')
var messageHandler = require('serializator')

var ScriptsManager = module.exports = function (options) {
  this.options = options
  this.options.timeout = this.options.timeout || 10000
}

ScriptsManager.prototype.start = function (cb) {
  cb()
}

ScriptsManager.prototype.ensureStarted = function (cb) {
  cb()
}

ScriptsManager.prototype.execute = function (inputs, options, cb) {
  var self = this
  var worker = childProcess.fork(path.join(__dirname, 'worker-processes.js'), self.options.forkOptions || {})
  var killed = false

  var timeout = setTimeout(function () {
    worker.kill()
    killed = true
    cb(new Error('Timeout error during executing script'))
  }, options.timeout || this.options.timeout)

  timeout.unref()

  worker.on('message', function (rawM) {
    var m = messageHandler.parse(rawM)

    if (killed) {
      return
    }

    if (m.error) {
      clearTimeout(timeout)
      var error = new Error(m.error)
      error.stack = m.errorStack
      return cb(error)
    }

    if (m.action === 'process-response') {
      clearTimeout(timeout)
      return cb(null, m.value)
    }

    if (m.action === 'callback') {
      m.params.push(function () {
        if (killed) {
          return
        }

        var args = Array.prototype.slice.call(arguments)

        if (args.length && args[0]) {
          args[0] = args[0].message
        }

        worker.send(messageHandler.serialize({
          action: 'callback-response',
          params: args
        }))
      })

      options.callback.apply(self, m.params)
    }
  })

  worker.send(messageHandler.serialize({
    inputs: inputs,
    options: options
  }))
}

ScriptsManager.prototype.kill = function () {
}
