var events = require('jslibs/winston/thirdPartyDeps/eventemitter2/eventemitter2'),
    util = require('jslibs/winston/thirdPartyDeps/nodejs/util/util'),
    colors = require('jslibs/winston/thirdPartyDeps/colors/colors'),
    common = require('../common'),
    Transport = require('./transport').Transport;
events.EventEmitter = events.EventEmitter2;

//
// ### function Memory (options)
// #### @options {Object} Options for this instance.
// Constructor function for the Memory transport object responsible
// for persisting log messages and metadata to a memory array of messages.
//
var Memory = exports.Memory = function (options) {
  Transport.call(this, options);
  options = options || {};

  this.writeOutput = [];

  this.json        = options.json !== false;
  this.colorize    = options.colorize    || false;
  this.prettyPrint = options.prettyPrint || false;
  this.timestamp   = typeof options.timestamp !== 'undefined' ? options.timestamp : true;
  this.label       = options.label       || null;

  if (this.json) {
    this.stringify = options.stringify || function (obj) {
      return JSON.stringify(obj, null, 2);
    };
  }
};

//
// Inherit from `winston.Transport`.
//
util.inherits(Memory, Transport);

//
// Expose the name of this Transport on the prototype
//
Memory.prototype.name = 'memory';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Memory.prototype.log = function (level, msg, meta, callback) {
  if (this.silent) {
    return callback(null, true);
  }

  var self = this,
      output;

  output = common.log({
    colorize:    this.colorize,
    json:        this.json,
    level:       level,
    message:     msg,
    meta:        meta,
    stringify:   this.stringify,
    timestamp:   this.timestamp,
    prettyPrint: this.prettyPrint,
    raw:         this.raw,
    label:       this.label
  });
  
  this.writeOutput.push(output);

  self.emit('logged');
  callback(null, true);
};

Memory.prototype.clearLogs = function () {
  this.writeOutput = [];
};

// Available query options:
// from, until, error (true => query error log, false => query info log
Memory.prototype.query = function (queryOptions, callback) {
    var results = [];
    var output;

    if (typeof queryOptions === 'function') {
        callback = queryOptions;
        queryOptions = {};
    }

    function check(log) {
        if (!log) return;

        if (typeof log === 'string') {
            try {
                log = JSON.parse(log);
            } catch (e) {
                return;
            }
        } else if (typeof log !== 'object') {
            return;
        }

        var time = new Date(log.timestamp);
        if ((queryOptions.from && time < queryOptions.from)
                || (queryOptions.until && time > queryOptions.until)) {
            return;
        }

        return log;
    }

    this.writeOutput.forEach(function (entry) {
        if (entry = check(entry)) {
            results.push(entry);
        }
    });

    callback(results);
};