/*
 * file.js: Transport for outputting to a local log file
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 *
 */

var events = require('jslibs/winston/thirdPartyDeps/eventemitter2/eventemitter2'),
    fs = require('vertx').fileSystem,
    path = require('jslibs/winston/thirdPartyDeps/nodejs/path/path'),
    util = require('jslibs/winston/thirdPartyDeps/nodejs/util/util'),
    colors = require('jslibs/winston/thirdPartyDeps/colors/colors'),
    common = require('../common'),
    Transport = require('./transport').Transport,
    Stream = require('jslibs/winston/thirdPartyDeps/nodejs/stream/stream').Stream,
    vertx = require('vertx');
events.EventEmitter = events.EventEmitter2;
util.inherits(fs.AsyncFile, events.EventEmitter);

//
// ### function File (options)
// #### @options {Object} Options for this instance.
// Constructor function for the File transport object responsible
// for persisting log messages and metadata to one or more files.
//
var File = exports.File = function (options) {
  Transport.call(this, options);

  var ext,              // filename extension (including dot)
  basenameWithoutExt,   // file basename without extension
  dirContents,          // directory contents of logfile directory
  fi,                   // filename iterator for loop    
  fileno,               // file number
  filenoStr;            // file number as a string
  
  //
  // Helper function which throws an `Error` in the event
  // that any of the rest of the arguments is present in `options`.
  //
  function throwIf (target /*, illegal... */) {
    Array.prototype.slice.call(arguments, 1).forEach(function (name) {
      if (options[name]) {
        throw new Error('Cannot set ' + name + ' and ' + target + 'together');
      }
    });
  }

  if (options.filename || options.dirname) {
    throwIf('filename or dirname', 'stream');
    this._basename = this.filename = options.filename
      ? path.basename(options.filename)
      : 'winston.log';

      if (this._basename.match('(\\d+)\\..+$') ||
              this._basename.match('(\\d+)$')) {
          throw new Error('Do not use a log filename with number at the end.');
      }

    this.dirname = options.dirname || path.dirname(options.filename);
    this.options = options.options || { flags: 'a' };

    //
    // "24 bytes" is maybe a good value for logging lines.
    //
    this.options.highWaterMark = this.options.highWaterMark || 24;
    
    // Initialize this._created and clean up
    ext = path.extname(this._basename);
    basenameWithoutExt = path.basename(this._basename, ext);
    dirContents = fs.readDirSync(this.dirname, basenameWithoutExt + '\\d*' + ext);
    // Set this._created to highest number of existing log files + 1
    for (fi = 0; fi < dirContents.length; fi++) {
        fileno = parseInt(dirContents[fi].match('(\\d*)'+ (ext ? '\\' + ext : '') + '$')[1], 10) || 0;
        this._created = Math.max(this._created, fileno + 1);
    }
    // If the allowed number of files is capped, delete surplus files
    if (this.maxFiles) {
        for (fi = 0; fi < dirContents.length; fi++) {
            filenoStr = dirContents[fi].match('(\\d*)'+ (ext ? '\\' + ext : '') + '$')[1];
            fileno = parseInt(filenoStr, 10) || 0;
            if (fileno < this._created - this.maxFiles) {
                try {
                    fs.deleteSync(path.join(this.dirname, basenameWithoutExt + filenoStr + ext));
                } catch (ignore) {}
            } 
        }      
    }
  }
  else if (options.stream) {
    throwIf('stream', 'filename', 'maxsize');
    this._stream = options.stream;

    //
    // We need to listen for drain events when
    // write() returns false. This can make node
    // mad at times.
    //
    this._stream.setMaxListeners(Infinity);
  }
  else {
    throw new Error('Cannot log to file without filename or stream.');
  }

  this.json        = options.json !== false;
  this.colorize    = options.colorize    || false;
  this.maxsize     = options.maxsize     || null;
  this.maxFiles    = options.maxFiles    || null;
  this.prettyPrint = options.prettyPrint || false;
  this.label       = options.label       || null;
  this.timestamp   = options.timestamp != null ? options.timestamp : true;

  if (this.json) {
    this.stringify = options.stringify;
  }

  //
  // Internal state variables representing the number
  // of files this instance has created and the current
  // size (in bytes) of the current logfile.
  //
  this._size     = 0;
  this._created  = 0;
  this._buffer   = [];
  this._draining = false;
};

//
// Inherit from `winston.Transport`.
//
util.inherits(File, Transport);

//
// Expose the name of this Transport on the prototype
//
File.prototype.name = 'file';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
File.prototype.log = function (level, msg, meta, callback) {
  if (this.silent) {
    return callback(null, true);
  }

  var self = this;

  if (typeof msg !== 'string') {
    msg = '' + msg;
  }

  var output = common.log({
    level:       level,
    message:     msg,
    meta:        meta,
    json:        this.json,
    colorize:    this.colorize,
    prettyPrint: this.prettyPrint,
    timestamp:   this.timestamp,
    stringify:   this.stringify,
    label:       this.label
  }) + '\n';

  if (!this.filename) {
    //
    // If there is no `filename` on this instance then it was configured
    // with a raw `WriteableStream` instance and we should not perform any
    // size restrictions.
    //
    this._write(output, callback);
  }
  else {
    this.open(function (err) {
      if (err) {
        //
        // If there was an error enqueue the message
        //
        self._buffer.push([output, callback]);
        return;
      }

      self._write(output, callback);
    });
  }
};

//
// ### function _write (data, cb)
// #### @data {String|Buffer} Data to write to the instance's stream.
// #### @cb {function} Continuation to respond to when complete.
// Write to the stream, ensure execution of a callback on completion.
//
File.prototype._write = function(data, callback) {
  // If this is a file write stream, we could use the builtin
  // callback functionality, however, the stream is not guaranteed
  // to be an fs.WriteStream.
  var dataBuf = data instanceof vertx.Buffer ? data : new vertx.Buffer(data);
  if (this.filename) {
      this._size += dataBuf.length();
  }

  this._stream.write(dataBuf);
  this.emit('logged');
  if (!callback) return;

  callback(null, true);
};

//
// ### function query (options, callback)
// #### @options {Object} Loggly-like query options for this instance.
// #### @callback {function} Continuation to respond to when complete.
// Query the transport. Options object is optional.
//
File.prototype.query = function (options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var file = path.join(this.dirname, this.filename),
      options = this.normalizeQuery(options),
      buff = '',
      results = [],
      row = 0;

  var stream;
  var streamIsClosed = false;
  fs.open(file, fs.OPEN_READ, function (openErr, asyncFile) {
      if (openErr) {
          callback(openErr);
          return;
      }
      stream = asyncFile;
      
      asyncFile.exceptionHandler(function (err) {
          try {
              if (!streamIsClosed) {
                  streamIsClosed = true;
                  asyncFile.close();
              }
          } catch (ignore) {}
          if (!callback) return;
          return callback(err);
      });

      asyncFile.dataHandler(function (dataBuf) {
          asyncFile.pause();
          var data = (buff + dataBuf.toString()).split(/\n+/),
          l = data.length - 1,
          i = 0;

          for (; i < l; i++) {
              if (!options.start || row >= options.start) {
                  add(data[i]);
              }
              row++;
          }

          buff = data[l];
          
          if (!streamIsClosed) {
              asyncFile.resume();
          }
      });
      
      asyncFile.endHandler(function () {
          try {
              if (!streamIsClosed) {
                  streamIsClosed = true;
                  asyncFile.close();
              }
          } catch (ignore) {}
          if (buff) add(buff, true);
          if (options.order === 'desc') {
            results = results.reverse();
          }
          if (callback) callback(null, results);
      });
  });

  function add(buff, attempt) {
    try {
      var log = JSON.parse(buff);
      if (check(log)) push(log);
    } catch (e) {
      if (!attempt) {
        stream.emit('error', e);
      }
    }
  }

  function push(log) {
      if (options.rows && results.length >= options.rows) {
          if (!streamIsClosed) {
              try {
                  streamIsClosed = true;
                  stream.close();
              } catch (ignore) {}
              // MOh: Replicate from endHandler because it will not be
              // called automatically on close.
              if (buff) add(buff, true);
              if (options.order === 'desc') {
                  results = results.reverse();
              }
              if (callback) callback(null, results);
          }
          return;
      }

    if (options.fields) {
      var obj = {};
      options.fields.forEach(function (key) {
        obj[key] = log[key];
      });
      log = obj;
    }

    results.push(log);
  }

  function check(log) {
    if (!log) return;

    if (typeof log !== 'object') return;

    var time = new Date(log.timestamp);
    if ((options.from && time < options.from)
        || (options.until && time > options.until)) {
      return;
    }

    return true;
  }
};

//
// ### function _tail (options, callback)
// #### @options {Object} Options for tail.
// #### @callback {function} Callback to execute on every line.
// `tail -f` a file. Options must include file.
//
// MOh: The implementation of "_tail" can not be ported to vertx because
// it is not possible to read on a file read stream once the end of the file
// has been reached, even if the file is written to aferwards.
File.prototype._tail = function tail(options, callback) {
    
  var stream = fs.createReadStream(options.file, { encoding: 'utf8' }),
      buff = '',
      destroy,
      row = 0;

  destroy = stream.destroy.bind(stream);
  stream.destroy = function () {};

  if (options.start === -1) {
    delete options.start;
  }

  if (options.start == null) {
    stream.once('end', bind);
  } else {
    bind();
  }

  function bind() {
    stream.on('data', function (data) {
      var data = (buff + data).split(/\n+/),
          l = data.length - 1,
          i = 0;

      for (; i < l; i++) {
        if (options.start == null || row > options.start) {
          stream.emit('line', data[i]);
        }
        row++;
      }

      buff = data[l];
    });

    stream.on('line', function (data) {
      if (callback) callback(data);
    });

    stream.on('error', function (err) {
      destroy();
    });

    stream.on('end', function () {
      if (buff) {
        stream.emit('line', buff);
        buff = '';
      }

      resume();
    });

    resume();
  }

  function resume() {
    setTimeout(function () {
      stream.resume();
    }, 1000);
  }

  return destroy;
};

//
// ### function stream (options)
// #### @options {Object} Stream options for this instance.
// Returns a log stream for this transport. Options object is optional.
//
// MOh: Currently not available on vertx because it relies on the "_tail"
// method above, which can not be ported.
/*
File.prototype.stream = function (options) {
  var file = path.join(this.dirname, this.filename),
      options = options || {},
      stream = new Stream;

  var tail = {
    file: file,
    start: options.start
  };

  stream.destroy = this._tail(tail, function (line) {
    try {
      stream.emit('data', line);
      line = JSON.parse(line);
      stream.emit('log', line);
    } catch (e) {
      stream.emit('error', e);
    }
  });

  return stream;
};
*/

//
// ### function open (callback)
// #### @callback {function} Continuation to respond to when complete
// Checks to see if a new file needs to be created based on the `maxsize`
// (if any) and the current size of the file used.
//
File.prototype.open = function (callback) {
  if (this.opening) {
    //
    // If we are already attempting to open the next
    // available file then respond with a value indicating
    // that the message should be buffered.
    //
    return callback(true);
  }
  else if (!this._stream || (this.maxsize && this._size >= this.maxsize)) {
    //
    // If we dont have a stream or have exceeded our size, then create
    // the next stream and respond with a value indicating that
    // the message should be buffered.
    //
    callback(true);
    return this._createStream();
  }

  //
  // Otherwise we have a valid (and ready) stream.
  //
  callback();
};

//
// ### function close ()
// Closes the stream associated with this instance.
//
File.prototype.close = function () {
    var self = this;

    if (this._buffer.length > 0) {
        // Close on flush
        this.once('flush', function () {
            if (self._stream && typeof self._stream.close === 'function') {
                try {
                    self._stream.close();
                } catch (ignore) {}
            }
            self.emit('close');
        });
    } else {
        // No buffer entries => close immediately
        if (self._stream && typeof self._stream.close === 'function') {
            try {
                self._stream.close();
            } catch (ignore) {}
        }
        self.emit('close');
    }
};

//
// ### function flush ()
// Flushes any buffered messages to the current `stream`
// used by this instance.
//
File.prototype.flush = function () {
  var self = this;

  //
  // Iterate over the `_buffer` of enqueued messaged
  // and then write them to the newly created stream.
  //
  var msgsToWrite = this._buffer.length;
  if (msgsToWrite === 0) {
      self.emit('flush');
      return;
  }
  
  this._buffer.forEach(function (item) {
    var str = item[0],
        callback = item[1];

    vertx.runOnContext(function () {
      self._write(str, callback);
      if (--msgsToWrite === 0) {
          // Last of the buffer messages written, when "flush" was called.
          // In the meantime, more messages might have piled up in the buffer,
          // so flush these synchronously.
          self._buffer.forEach(function (item) {
              var str = item[0],
                  callback = item[1];
              self._write(str, callback);
          });
          // Truncate the buffer again
          self._buffer.length = 0;

          // Emitting flush triggers a callback, which sets the "opening" flag
          // to false
          self.emit('flush');
      }
    });
  });

  //
  // Quickly truncate the `_buffer` once the write operations
  // have been started. New messages will be written to the buffer from index 0
  // until the "opening" flag is finally set to false. Those messages will be
  // written synchronously when the last of the original buffer messages is
  // written. See code above.
  //
  self._buffer.length = 0;
};

//
// ### @private function _createStream ()
// Attempts to open the next appropriate file for this instance
// based on the common state (such as `maxsize` and `_basename`).
//
File.prototype._createStream = function () {
  var self = this;
  this.opening = true;

  (function checkFile (target) {
    var fullname = path.join(self.dirname, target);

    //
    // Creates the `WriteStream` and then flushes any
    // buffered messages.
    //
    function createAndFlush (size) {
      // If we have an open file, close it before opening a new one
      if (self._stream && typeof self._stream.close === 'function') {
        try {
            self._stream.close();
        } catch (ignore) {}
      }
      self._size = size;
      self.filename = target;
      fs.open(fullname, function (err, asyncFile) {
          self._stream = asyncFile;
          
          //
          // We need to listen for drain events when
          // write() returns false. This can make node
          // mad at times.
          //
          self._stream.setMaxListeners(Infinity);

          //
          // When the current stream has finished flushing
          // then we can be sure we have finished opening
          // and thus can emit the `open` event.
          //
          self.once('flush', function () {
            self.opening = false;
            self.emit('open', fullname);
          });

          //
          // Remark: It is possible that in the time it has taken to find the
          // next logfile to be written more data than `maxsize` has been buffered,
          // but for sensible limits (10s - 100s of MB) this seems unlikely in less
          // than one second.
          //
          self.flush();
      });
    }

    fs.props(fullname, function (err, stats) {
      if (err) {
        if (err.toString().indexOf('NoSuchFile') === -1) {
          // If other error than "no such file or directory", emit an error
          // and return without a new stream
          return self.emit('error', err);
        }
        // If a "no such file or directory" error occurred, create a new file
        // (with 0 bytes)
        return createAndFlush(0);
      }
      
      // The file already exists => create new one (appending currently
      // not possible with vertx
      return checkFile(self._getFile(true));
    });
  })(this._getFile());
};

//
// ### @private function _getFile ()
// Gets the next filename to use for this instance
// in the case that log filesizes are being capped.
//
File.prototype._getFile = function (inc) {
  var self = this,
      ext = path.extname(this._basename),
      basename = path.basename(this._basename, ext),
      remaining;
  
  if (inc) {
    //
    // Increment the number of files created or
    // checked by this instance.
    //
    // Check for maxFiles option and delete file
    if (this.maxFiles && (this._created >= (this.maxFiles - 1))) {
      remaining = this._created - (this.maxFiles - 1);
      if (remaining === 0) {
          try {
              fs.deleteSync(path.join(this.dirname, basename + ext));
          } catch (ignore) {}
      }
      else {
          try {
              fs.deleteSync(path.join(this.dirname, basename + remaining + ext));
          } catch (ignore) {}
      }
    }

    this._created += 1;
  }
  
  return this._created
    ? basename + this._created + ext
    : basename + ext;
};

//
// ### @private function _lazyDrain ()
// Lazily attempts to emit the `logged` event when `this.stream` has
// drained. This is really just a simple mutex that only works because
// Node.js is single-threaded.
//
// Not used on vertx because of different "drain semantics". The logged event
// will be emitted for each stream write for vertx.
File.prototype._lazyDrain = function () {
  var self = this;

  if (!this._draining && this._stream) {
    this._draining = true;

    this._stream.once('drain', function () {
      this._draining = false;
      self.emit('logged');
    });
  }
};
