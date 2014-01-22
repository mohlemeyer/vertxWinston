# winston

A multi-transport async logging library for node.js (ported to Vert.x). <span style="font-size:28px; font-weight:bold;">&quot;CHILL WINSTON! ... I put it in the logs.&quot;</span>

## Motivation
Winston is designed to be a simple and universal logging library with support for multiple transports. A transport is essentially a storage device for your logs. Each instance of a winston logger can have multiple transports configured at different levels. For example, one may want error logs to be stored in a persistent remote location (like a database), but all logs output to the console or a local file.

There also seemed to be a lot of logging libraries out there that coupled their implementation of logging (i.e. how the logs are stored / indexed) to the API that they exposed to the programmer. This library aims to decouple those parts of the process to make it more flexible and extensible.

## Usage
There are two different ways to use winston: directly via the default logger, or by instantiating your own Logger. The former is merely intended to be a convenient shared logger to use throughout your application if you so choose.

* [Logging](#logging)
  * [Using the Default Logger](#using-the-default-logger)
  * [Instantiating your own Logger](#instantiating-your-own-logger)
  * [Logging with Metadata](#logging-with-metadata)
  * [String interpolation](#string-interpolation)
* [Profiling](#profiling)
* [Streaming Logs](#streaming-logs)
* [Querying Logs](#querying-logs)  
* [Logging Levels](#logging-levels)
  * [Using Logging Levels](#using-logging-levels)
  * [Using Custom Logging Levels](#using-custom-logging-levels)
* [Further Reading](#further-reading)
  * [Events and Callbacks in Winston](#events-and-callbacks-in-winston)
  * [Working with multiple Loggers in winston](#working-with-multiple-loggers-in-winston)
  * [Using winston in a CLI tool](#using-winston-in-a-cli-tool)
  * [Extending another object with Logging](#extending-another-object-with-logging)
* [Working with Transports](#working-with-transports)
	* [Adding Custom Transports](#adding-custom-transports)
* [Installation](#installation)
* [Run Tests](#run-tests)


## Logging

### Using the Default Logger
The default logger is accessible through the winston module directly. Any method that you could call on an instance of a logger is available on the default logger:

``` js
  var winston = require('winston');

  winston.log('info', 'Hello distributed log files!');
  winston.info('Hello again distributed logs');
```

By default, only the Console transport is set on the default logger. You can add or remove transports via the add() and remove() methods:

``` js
  winston.add(winston.transports.File, { filename: 'somefile.log' });
  winston.remove(winston.transports.Console);
```

For more documentation about working with each individual transport supported by Winston see the [Working with Transports](#working-with-transports) section below.

### Instantiating your own Logger
If you would prefer to manage the object lifetime of loggers you are free to instantiate them yourself:

``` js
  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename: 'somefile.log' })
    ]
  });
```

You can work with this logger in the same way that you work with the default logger:

``` js
  //
  // Logging
  //
  logger.log('info', 'Hello distributed log files!');
  logger.info('Hello again distributed logs');

  //
  // Adding / Removing Transports
  //   (Yes It's chainable)
  //
  logger.add(winston.transports.File)
        .remove(winston.transports.Console);
```

### Logging with Metadata
In addition to logging string messages, winston will also optionally log additional JSON metadata objects. Adding metadata is simple:

``` js
  winston.log('info', 'Test Log Message', { anything: 'This is metadata' });
```

The way these objects is stored varies from transport to transport (to best support the storage mechanisms offered). Here's a quick summary of how each transports handles metadata:

1. __Console:__ Logged via node's `util.inspect(meta)`, e.g.
`info: Test Log Message anything=This is metadata`

2. __File:__ Logged via node's `util.inspect(meta)`, e.g.
`{"anything":"This is metadata","level":"info","message":"Test Log Message","timestamp":"2013-12-22T14:15:50.375Z"}`

## Profiling
In addition to logging messages and metadata, winston also has a simple profiling mechanism implemented for any logger:

``` js
  //
  // Start profile of 'test'
  // Remark: Consider using Date.now() with async operations
  //
  winston.profile('test');

  setTimeout(function () {
    //
    // Stop profile of 'test'. Logging will now take place:
    //   "17 Jan 21:00:00 - info: test duration=1000ms"
    //
    winston.profile('test');
  }, 1000);
```

All profile messages are set to the 'info' by default and both message and metadata are optional There are no plans in the Roadmap to make this configurable, but I'm open to suggestions / issues.

### String interpolation
The `log` method provides the same string interpolation methods like node's [`util.format`][10].  

This allows for the following log messages.
``` js
logger.log('info', 'test message %s', 'my string');
// info: test message my string

logger.log('info', 'test message %d', 123);
// info: test message 123

logger.log('info', 'test message %j', {number: 123}, {});
// info: test message {"number":123}
// meta = {}

logger.log('info', 'test message %s, %s', 'first', 'second', {number: 123});
// info: test message first, second
// meta = {number: 123}

logger.log('info', 'test message', 'first', 'second', {number: 123});
// info: test message first second
// meta = {number: 123}

logger.log('info', 'test message %s, %s', 'first', 'second', {number: 123}, function();
// info: test message first, second
// meta = {numer: 123}
// callback = function(){}

logger.log('info', 'test message', 'first', 'second', {number: 123}, function());
// info: test message first second
// meta = {numer: 123}
// callback = function(){}
```

## Querying Logs
Winston supports querying of logs with Loggly-like options.
Specifically: `Memory` and `EbMongo`

``` js
  var options = {
    from: new Date - 24 * 60 * 60 * 1000,
    until: new Date
  };

  //
  // Find items logged between today and yesterday.
  //
  winston.query(options, function (err, results) {
    if (err) {
      throw err;
    }
    
    console.log(results);
  });
```

## Streaming Logs
Streaming allows you to stream your logs back from your chosen transport.

``` js
  winston.stream().on('log', function(log) {
    console.log(log);
  });
```

> Note that this operation might require reading an already written log message
from a transport. It can be used to check if log messages get written as
expected.

## Logging Levels

### Using Logging Levels
Setting the level for your logging message can be accomplished in one of two ways. You can pass a string representing the logging level to the log() method or use the level specified methods defined on every winston Logger.

``` js
  //
  // Any logger instance
  //
  logger.log('info', "127.0.0.1 - there's no place like home");
  logger.log('warn', "127.0.0.1 - there's no place like home");
  logger.log('error', "127.0.0.1 - there's no place like home");
  logger.info("127.0.0.1 - there's no place like home");
  logger.warn("127.0.0.1 - there's no place like home");
  logger.error("127.0.0.1 - there's no place like home");

  //
  // Default logger
  //
  winston.log('info', "127.0.0.1 - there's no place like home");
  winston.info("127.0.0.1 - there's no place like home");
```

Winston allows you to set a `level` on each transport that specifies the level of messages this transport should log. For example, you could log only errors to the console, with the full logs in a file:

``` js
  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'error' }),
      new (winston.transports.File)({ filename: 'somefile.log' })
    ]
  });
```

As of 0.2.0, winston supports customizable logging levels, defaulting to [npm][0] style logging levels. Changing logging levels is easy:

``` js
  //
  // Change levels on the default winston logger
  //
  winston.setLevels(winston.config.syslog.levels);

  //
  // Change levels on an instance of a logger
  //
  logger.setLevels(winston.config.syslog.levels);
```

Calling `.setLevels` on a logger will remove all of the previous helper methods for the old levels and define helper methods for the new levels. Thus, you should be careful about the logging statements you use when changing levels. For example, if you ran this code after changing to the syslog levels:

``` js
  //
  // Logger does not have 'silly' defined since that level is not in the syslog levels
  //
  logger.silly('some silly message');
```

### Using Custom Logging Levels
In addition to the predefined `npm` and `syslog` levels available in Winston, you can also choose to define your own:

``` js
  var myCustomLevels = {
    levels: {
      foo: 0,
      bar: 1,
      baz: 2,
      foobar: 3
    },
    colors: {
      foo: 'blue',
      bar: 'green',
      baz: 'yellow',
      foobar: 'red'
    }
  };

  var customLevelLogger = new (winston.Logger)({ levels: myCustomLevels.levels });
  customLevelLogger.foobar('some foobar level-ed message');
```

Although there is slight repetition in this data structure, it enables simple encapsulation if you not to have colors. If you do wish to have colors, in addition to passing the levels to the Logger itself, you must make winston aware of them:

``` js
  //
  // Make winston aware of these colors
  //
  winston.addColors(myCustomLevels.colors);
```

This enables transports with the 'colorize' option set to appropriately color the output of custom levels.

## Further Reading

### Events and Callbacks in Winston
Each instance of winston.Logger is also an instance of an [EventEmitter][1]. A log event will be raised each time a transport successfully logs a message:

``` js
  logger.on('logging', function (transport, level, msg, meta) {
    // [msg] and [meta] have now been logged at [level] to [transport]
  });

  logger.info('CHILL WINSTON!', { seriously: true });
```

It is also worth mentioning that the logger also emits an 'error' event which you should handle or suppress if you don't want unhandled exceptions:

``` js
  //
  // Handle errors
  //
  logger.emitErrs = true; // Set explicitely to "true" to receive errors;
                          // leave unset or set to "false" to suppress errors
                          
  logger.on('error', function (err) { /* Do Something */ });

```

Every logging method described in the previous section also takes an optional callback which will be called only when all of the transports have logged the specified message.

``` js
  logger.info('CHILL WINSTON!', { seriously: true }, function (err, level, msg, meta) {
    // [msg] and [meta] have now been logged at [level] to **every** transport.
  });
```

### Working with multiple Loggers in winston

Often in larger, more complex applications it is necessary to have multiple logger instances with different settings. Each logger is responsible for a different feature area (or category). This is exposed in `winston` in two ways: through `winston.loggers` and instances of `winston.Container`. In fact, `winston.loggers` is just a predefined instance of `winston.Container`:

``` js
  var winston = require('winston');

  //
  // Configure the logger for `category1`
  //
  winston.loggers.add('category1', {
    console: {
      level: 'silly',
      colorize: 'true',
      label: 'category one'
    },
    file: {
      filename: '/path/to/some/file'
    }
  });

  //
  // Configure the logger for `category2`
  //
  winston.loggers.add('category2', {
    couchdb: {
      host: '127.0.0.1',
      port: 5984
    }
  });
```

Now that your loggers are setup you can require winston _in any file in your application_ and access these pre-configured loggers:

``` js
  var winston = require('winston');

  //
  // Grab your preconfigured logger
  //
  var category1 = winston.loggers.get('category1');

  category1.info('logging from your IoC container-based logger');
```

If you prefer to manage the `Container` yourself you can simply instantiate one:

``` js
  var winston = require('winston'),
      container = new winston.Container();

  container.add('category1', {
    console: {
      level: 'silly',
      colorize: 'true'
    },
    file: {
      filename: '/path/to/some/file'
    }
  });
```

### Sharing transports between Loggers in winston

``` js
  var winston = require('winston');

  //
  // Setup transports to be shared across all loggers
  // in three ways:
  //
  // 1. By setting it on the default Container
  // 2. By passing `transports` into the constructor function of winston.Container
  // 3. By passing `transports` into the `.get()` or `.add()` methods
  //

  //
  // 1. By setting it on the default Container
  //
  winston.loggers.options.transports = [
    // Setup your shared transports here
  ];

  //
  // 2. By passing `transports` into the constructor function of winston.Container
  //
  var container = new winston.Container({
    transports: [
      // Setup your shared transports here
    ]
  });

  //
  // 3. By passing `transports` into the `.get()` or `.add()` methods
  //
  winston.loggers.add('some-category', {
    transports: [
      // Setup your shared transports here
    ]
  });

  container.add('some-category', {
    transports: [
      // Setup your shared transports here
    ]
  });
```

### Using winston in a CLI tool
A common use-case for logging is output to a CLI tool. Winston has a special
`cli` helper method which configures a logger to format ouput for command line
interfaces: no timestamp, colors enabled, padded output, and additional levels

Example:
```
  info:   require-analyzer starting in /Users/Charlie/Nodejitsu/require-analyzer
  info:   Found existing dependencies
  data:   {
  data:     colors: '0.x.x',
  data:     eyes: '0.1.x',
  data:     findit: '0.0.x',
  data:     npm: '1.0.x',
  data:     optimist: '0.2.x',
  data:     semver: '1.0.x',
  data:     winston: '0.2.x'
  data:   }
  info:   Analyzing dependencies...
  info:   Done analyzing raw dependencies
  info:   Retrieved packages from npm
  warn:   No additional dependencies found
```

Configuring output for this style is easy, just use the `.cli()` method on `winston` or an instance of `winston.Logger`:

``` js
  var winston = require('winston');

  //
  // Configure CLI output on the default logger
  //
  winston.cli();

  //
  // Configure CLI on an instance of winston.Logger
  //
  var logger = new winston.Logger({
    transports: [
      new (winston.transports.Console)()
    ]
  });

  logger.cli();
```

### Extending another object with Logging
Often in a given code base with lots of Loggers it is useful to add logging methods to a different object so that these methods can be called with less syntax. Winston exposes this functionality via the 'extend' method:

``` js
  var myObject = {};

  logger.extend(myObject);

  //
  // You can now call logger methods on 'myObject'
  //
  myObject.info("127.0.0.1 - there's no place like home");
```

## Working with Transports
A few transports are supported by winston core:
   
1. __Console:__ Output to the terminal
2. __File:__ Append to a file

### Console Transport
``` js
  winston.add(winston.transports.Console, options)
```

The Console transport takes the following options:

* __level:__ Level of messages that this transport should log (default 'info').
* __silent:__ Boolean flag indicating whether to suppress output (default false).
* __colorize:__ Boolean flag indicating if we should colorize output with ANSI escape color codes (default false); has no effect in JSON mode.
* __timestamp:__ Boolean flag indicating if we should prepend output with timestamps (default false). If a function is specified instead of a boolean flag, its return value will be used instead of timestamps.
* __label:__ String to prepend to each log message; has no effect in JSON mode.
* __json:__ Boolean flag indicating if output should be formatted as human readable JSON, i.e. one property per line.

*Metadata:* Logged via Node's util.inspect(meta).

### File Transport
``` js
  winston.add(winston.transports.File, options)
```

The File transport should really be the 'Stream' transport since it will accept any [WriteStream][14]. It is named such because it will also accept filenames via the 'filename' option:

* __level:__ Level of messages that this transport should log (default 'info').
* __silent:__ Boolean flag indicating whether to suppress output (default false).
* __colorize:__ Boolean flag indicating if we should colorize output with ANSI escape color codes (default false); has no effect in JSON mode.
* __timestamp:__ Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
* __filename:__ The filename of the logfile to write output to; only one of the __filename__ or __stream__ options must be specified.
* __maxsize:__ Max size in bytes of the logfiles; if the size is exceeded then a new file is created. The actual filesize might exceed
__maxsize__ because the file size is not checked on every log call. File names are generated by appending a continuosly increasing number
to the file base name (w/o extension).
* __maxFiles:__ Limit the number of log files when __maxsize__ is specified by deleting old files.
* __stream:__ The _WriteStream_ to write output to; only one of the __filename__ or __stream__ options must be specified.
* __json:__ If true, messages will be logged as JSON (default true).
* __label:__ String to prepend to each log message; has no effect in JSON mode.

*Metadata:* Logged via Node's util.inspect(meta).

### Event Bus MongoDB Transport

_EbMongo_ is an MongoDb database transport, making use of the Vert.x event bus
to store log messages via the [MongoDB persistor][20] module. Note that the
MongoDB persistor module has to be started and listening on the event bus
before the _EbMongo_ transport can be used.

``` js
  var EbMongo = require('winston-mongodb').EbMongo;
  winston.add(MongoDB, options);
```
The _EbMongo_ transport takes the following options:
* __ebAddress:__ {string} The event bus address of the MongoDb persistor
module. *[required]* Adding the transport without this argument will
throw an error.
* __name:__ {string; default `ebMongo`} Individual name of this transport
instance.
* __level:__ {string; default `info`} Level of messages that this transport should log. 
* __silent:__ {boolean, default `false`} Boolean flag indicating whether to suppress output.
* __collection:__ {string; default `logs`} The name of the collection you want to store log messages in.
* __writeConcern:__ {string; default `SAFE`} MongoDb _Write Concern_; valid
values are `NONE`, `NORMAL`, `SAFE`, `MAJORITY`, `FSYNC_SAFE`, `JOURNAL_SAFE`
and `REPLICAS_SAFE`. See the MongoDb Java Driver API for a detailed description.

*Metadata:* Logged as a native JSON object.

### Event Bus Mail Transport

_EbMail_ is an email transport, making use of the Vert.x event bus to send
messages via the [A-mailer][19] module. Note that the mailer module has to be
started and listening on the event bus before the _EbMail_ transport can be
used.

``` js
  winston.add(winston.transports.EbMail, options)
```

The _EbMail_ transport takes the following options:
* __ebAddress:__ {string} The event bus address of the mailer
module. *[required]* Adding the transport without this argument will
throw an error.
* __name:__ {string; default `ebMail`} Individual name of this transport
instance.
* __from:__ The default "from" address of the email log messages in
RFC822 format (e.g. `john.doe@email.com` or `John Doe <john.doe@email.com>`.
Can be overridden by a metadata property of the same name in individual
log calls.
* __to:__ {string|array} The default "to" address(es) of the email log messages
as a string or an array of strings. Can be overridden by a metadata property of
the same name in individual log calls.
* __cc:__ {string|array} The default "cc" address(es) of the email log messages
as a string or an array of strings. Can be overridden by a metadata property of
the same name in individual log calls. *[optional]*
* __allowLogOverride:__ {boolean; default: `false`} Flag wether to allow
overriding the "from", "to" an "cc" values by metadata in individual log calls.
If set to `false` the values can not be overridden and are kept as log call
metadata if provided. If set to `true` these properties are automatically
removed from log call metadata.
* __timestampFn:__ {function} As a default Timestamps are provided as strings
in ISO-format without a timezone (using JavaScript's `toISOString` method). If
you prefer a different format you can specifiy your own timestamp function,
which must return a string, e.g.
`function () { return new Date().toLocaleString('de-DE'); }`
* __subjTempl:__ {string} ERB-style template for the email subject. A fixed
string is valid, too, of course. The following variables are available:
    * __name:__ Transport instance name.
    * __level:__ Log level.
    * __timestamp:__ Date/Time of a log call.
    * __message:__ The log message.
    * __metaStringified:__ Stringified, pretty printed metadata.
    * _metadata properties:_ All properties of the metadata object in an
    individual log call are available.
    * Example: The default template for the email subject looks like this:
    `<%= name %> [<%= level %>]: <%= message %>`.
* __bodyTempl:__ {string} ERB-style template for the email body. The same
variables as for the email subject are available.
* __level:__ {string; default `info`} Level of messages that this transport should log. 
* __silent:__ {boolean, default `false`} Boolean flag indicating whether to suppress output.

### Adding Custom Transports
Adding a custom transport (say for one of the datastore on the Roadmap) is actually pretty easy. All you need to do is accept a couple of options, set a name, implement a log() method, and add it to the set of transports exposed by winston.

``` js
  var util = require('util'),
      winston = require('winston');

  var CustomLogger = winston.transports.CustomerLogger = function (options) {
    //
    // Name this logger
    //
    this.name = 'customLogger';

    //
    // Set the level from your options
    //
    this.level = options.level || 'info';

    //
    // Configure your storage backing as you see fit
    //
  };

  //
  // Inherit from `winston.Transport` so you can take advantage
  // of the base functionality and `.handleExceptions()`.
  //
  util.inherits(CustomLogger, winston.Transport);

  CustomLogger.prototype.log = function (level, msg, meta, callback) {
    //
    // Store this message and metadata, maybe use some custom logic
    // then callback indicating success.
    //
    callback(null, true);
  };
```

### Inspirations
1. [npm][0]
2. [log.js][4]
3. [socket.io][5]
4. [node-rlog][6]
5. [BigBrother][7]
6. [Loggly][8]

## Installation

The module can be installed by calling

```javascript
vertx install mohlemeyer~winstonVertx~{version} 
```

(See the Vert.x [module registry](http://modulereg.vertx.io) for the latest
available release.)

## Run Tests

Simply run the module with `vertx runmod mohlemeyer~winstonVertx~{version}` to
run the unit tests. If not already present this call will install the
[vertxQunitSinon](https://github.com/mohlemeyer/vertxQunitSinon) JavaScript
testrunner as a prerequisite.

The integration tests can be executed by running the module with a
configuration option `integrationTests` set to `true`, i.e.

```javascript
vertx runmod mohlemeyer~winstonVertx~{version} -conf iTestConf.JSON
```

where `iTestConf.JSON` is a file with the following contents:

```javascript
{
    "integrationTests": true
}
```

#### Author: [Charlie Robbins](http://twitter.com/indexzero)
#### Contributors: [Matthew Bergman](http://github.com/fotoverite), [Marak Squires](http://github.com/marak)
#### Vert.x Port: [Matthias Ohlemeyer](https://github.com/mohlemeyer)

### License
Winston is released under the MIT license. See the LICENSE file under
`jslibs/winston`. This applies to all files except where otherwise noted.

Winston depends on some third party libraries, which are located under
`jsblibs/winston/thirdPartyDeps`. These are released under their respective
license.

[0]: https://github.com/isaacs/npmlog
[1]: http://nodejs.org/docs/v0.3.5/api/events.html#events.EventEmitter
[2]: http://github.com/nodejitsu/require-analyzer
[3]: http://nodejitsu.com
[4]: https://github.com/visionmedia/log.js
[5]: http://socket.io
[6]: https://github.com/jbrisbin/node-rlog
[7]: https://github.com/feisty/BigBrother
[8]: http://loggly.com
[9]: http://vowsjs.org
[10]: http://nodejs.org/api/util.html#util_util_format_format
[14]: http://vertx.io/core_manual_js.html#writestream
[16]: https://github.com/indexzero/winston-mongodb
[17]: https://github.com/indexzero/winston-riak
[18]: https://github.com/appsattic/winston-simpledb
[19]: https://github.com/mohlemeyer/a-mailer
[19]: https://github.com/mohlemeyer/a-mailer
[20]: https://github.com/vert-x/mod-mongo-persistor
[21]: https://github.com/jesseditson/winston-sns
[22]: https://github.com/flite/winston-graylog2
[23]: https://github.com/kenperkins/winston-papertrail
