/**
 * QUnit integration tests for winston core.
 * 
 * Copyright (c) 2013 Matthias Ohlemeyer
 *  
 * @author Matthias Ohlemeyer (mohlemeyer@gmail.com)
 * @license
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this file (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
require('jslibs/qunit/qunit/qunitContext')(this);
var vertx = require('vertx');
var console = require('vertx/console');

var winston = require('jslibs/winston/lib/winston');

//==========================================================================
QUnit.module('winston.DefaultLogger', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('should provide log methods', function () {
    equal(typeof winston.log, 'function');
    equal(typeof winston.info, 'function');
    equal(typeof winston.error, 'function');
});

test('console.log should be called on winston log call', function () {
    var logMsg = 'abc';

    winston.info(logMsg);
    ok(this.consoleLogSpy.called, 'console.log called');
    ok(this.consoleLogSpy.firstCall.calledWithMatch(logMsg),
    'console.log called with matching argument');
});

test('should provide methods to add/remove transports', function () {
    equal(typeof winston.add, 'function');
    equal(typeof winston.remove, 'function');
});

test('console.log should not be called after transport is removed', function () {
    var logMsg = 'abc';

    winston.remove(winston.transports.Console);
    winston.info(logMsg);
    ok(!this.consoleLogSpy.called, 'console.log not called');
    winston.add(winston.transports.Console);
});

test('should log to added (memory) logger', function () {
    var logMsg = 'abc';
    var queryOptions;

    winston.remove(winston.transports.Console);
    winston.add(winston.transports.Memory);
    winston.info(logMsg);

    queryOptions = { // Find items logged between now and yesterday
            from: new Date() - 24 * 60 * 60 * 1000,
            until: new Date()
    };
    winston.query(queryOptions, function (err, results) {
        if (err) {
            throw err;
        }
        equal(results.memory[0].level, 'info', 'logged with info level');
        equal(results.memory[0].message, logMsg, 'logged message');
    });

    winston.add(winston.transports.Console);
});

//==========================================================================
QUnit.module('winston.newLoggerInstance', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('should create a new logger', function () {
    var logger = new winston.Logger();

    equal(typeof logger.log, 'function', 'has log method');
    equal(typeof logger.info, 'function', 'has info method');
    equal(typeof logger.error, 'function', 'has error method');
    equal(typeof logger.add, 'function', 'has add method');
    equal(typeof logger.remove, 'function', 'has remove method');
});

test('new logger without transport should not log', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger();

    logger.info(logMsg);
    ok(!this.consoleLogSpy.called, 'console.log not called');
});

test('new logger with console transport log to console', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)()]
    });

    logger.info(logMsg);
    ok(this.consoleLogSpy.called, 'console.log called');
});

test('should be possible to add and remove transports to/from new logger', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger();

    logger.info(logMsg);
    ok(!this.consoleLogSpy.called, 'console.log not called');
    logger.add(winston.transports.Console);
    logger.info(logMsg);
    ok(this.consoleLogSpy.called, 'console.log called');
    logger.remove(winston.transports.Console);
    logger.info(logMsg);
    ok(this.consoleLogSpy.calledOnce, 'console.log called once');
});
//==========================================================================
QUnit.module('winston.loggingWithMetadata', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('Metadata should be in log message', function () {
    var logEntry;
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)({json: true})]
    });

    logger.log('info', 'Test Log Message', { msg: { to: 'me', body: 'This is the body'} });
    logEntry = JSON.parse(this.consoleLogSpy.firstCall.args[0]);
    equal(logEntry.level, 'info');
    equal(logEntry.message, 'Test Log Message');
    equal(logEntry.msg.to, 'me');
    equal(logEntry.msg.body, 'This is the body');
});

//==========================================================================
QUnit.module('winston.profile', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

asyncTest('should log to console with duration', function () {
    var self = this;
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)()]
    });

    logger.profile('testBoundary');
    vertx.setTimer(100, function () {
        logger.profile('testBoundary');

        ok(self.consoleLogSpy.firstCall.calledWithMatch('testBoundary'),
        'console.log called with boundary argument');
        ok(self.consoleLogSpy.firstCall.calledWithMatch('duration'),
        'console.log called with duration argument');
        start();
    });
});

//==========================================================================
QUnit.module('winston.interpolation', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('should interpolate log message', function () {
    var logEntry;
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)({json: true})]
    });

    logger.log('info', 'test message %s, %s', 'first', 'second', {number: 123});
    logEntry = JSON.parse(this.consoleLogSpy.firstCall.args[0]);
    equal(logEntry.level, 'info');
    equal(logEntry.message, 'test message first, second');
    equal(logEntry.number, 123);
});

//==========================================================================
QUnit.module('winston.query');
//==========================================================================

asyncTest('memory logger should contain two entries after logging twice', function () {
    var logger = new winston.Logger({
        transports: [new (winston.transports.Memory)()]
    });
    var queryOptions;

    logger.info('one');
    logger.info('two');

    queryOptions = {
            from: new Date() - 24 * 60 * 60 * 1000,
            until: new Date()
    };
    logger.query(queryOptions, function (err, results) {
        if (err) throw new Error(err);
        equal(results.memory.length, 2, 'two entries returned from query');
        start();
    });
});

asyncTest('query to memory logger should constrain results by from and until', function () {
    var logger = new winston.Logger({
        transports: [new (winston.transports.Memory)()]
    });
    var logOneDate;

    logger.info('one');
    logOneDate = new Date();
    vertx.setTimer(100, function () {
        logger.info('two');
    });

    vertx.setTimer(200, function () {
        var now = new Date();
        var queryOptions = {
                from: now - 24 * 60 * 60 * 1000,
                until: now
        };

        logger.query(queryOptions, function (err, results) {
            if (err) throw new Error(err); 
            equal(results.memory.length, 2, 'two entries returned from query');

            queryOptions.until = new Date(logOneDate.getTime() + 1);
            logger.query(queryOptions, function (err, results) {
                if (err) throw new Error(err);

                equal(results.memory.length, 1, 'one entry returned from query');
                start();
            });

        });

    });
});

//==========================================================================
QUnit.module('winston.streamingLogs', {
//==========================================================================
setup: function () {
    this.consoleLogSpy = sinon.spy();
    this.origConsoleLog = console.log;
    console.log = this.consoleLogSpy;
},
teardown: function () {
    // Reset console.log
    console.log = this.origConsoleLog;
}
});

asyncTest('should echo the message sent to the console', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)({json: true})]
    });

    logger.stream().on('log', function (log) {
        equal(JSON.parse(log).message, logMsg, 'streamed message');
        start();
    });

    logger.info(logMsg);
});

//==========================================================================
QUnit.module('winston.loggingLevels');
//==========================================================================

asyncTest('memory log should only store important log messages', function () {
    var queryOptions;
    var logger = new winston.Logger({
        transports: [new (winston.transports.Memory)({ level: 'warn' })]
    });

    // These should be ignored
    logger.info('info log 1');
    logger.log('info', 'info log 2');

    // These should be logged
    logger.warn('warn log 1');
    logger.log('warn', 'warn log 2');
    logger.error('error log 1');
    logger.log('error', 'error log 2');

    queryOptions = {
            from: new Date() - 24 * 60 * 60 * 1000,
            until: new Date()
    };

    logger.query(queryOptions, function (err, results) {
        if (err) throw new Error(err);

        equal(results.memory.length, 4, 'warn and error messages logged');
        start();
    });
});

asyncTest('memory log should only store error log messages for cli levels', function () {
    var queryOptions;
    var logger = new winston.Logger({
        transports: [new (winston.transports.Memory)({ level: 'error' })]
    });
    logger.setLevels(winston.config.cli.levels);

    // These should be ignored
    logger.info('info log 1');
    logger.log('info', 'info log 2');
    logger.warn('warn log 1');
    logger.log('warn', 'warn log 2');

    // These should be logged
    logger.error('error log 1');
    logger.log('error', 'error log 2');

    queryOptions = {
            from: new Date() - 24 * 60 * 60 * 1000,
            until: new Date()
    };

    logger.query(queryOptions, function (err, results) {
        if (err) throw new Error(err);

        equal(results.memory.length, 2, 'error messages logged');
        start();
    });
});

asyncTest('memory log should only store certain log messages for custom levels', function () {
    var queryOptions;
    var logLevels = {
            levels: {
                alright: 0,
                danger: 1,
                catastrophy: 2
            },
            colors: {
                alright: 'green',
                danger: 'yellow',
                catastrophy: 'red'
            }
    };
    var logger = new winston.Logger({
        levels: logLevels.levels,
        transports: [new (winston.transports.Memory)({ level: 'danger' })]
    });
    winston.addColors(logLevels.colors);

    // These should be ignored
    logger.alright('info log 1');
    logger.alright('alright', 'alright log 2');

    // These should be logged
    logger.danger('danger log 1');
    logger.log('danger', 'danger log 2');   
    logger.catastrophy('catastrophy log 1');
    logger.log('catastrophy', 'catastrophy log 2');

    queryOptions = {
            from: new Date() - 24 * 60 * 60 * 1000,
            until: new Date()
    };

    logger.query(queryOptions, function (err, results) {
        if (err) throw new Error(err);

        equal(results.memory.length, 4, 'error messages logged');
        start();
    });
});

//==========================================================================
QUnit.module('winston.events');
//==========================================================================

asyncTest('logged event handler should be called with arguments', function () {
    var logger = new winston.Logger({
        transports: [
                     new (winston.transports.Memory)(),
                     new (winston.transports.Console)({silent: true})
                     ]
    });
    var logMsg = 'abc';
    var logMeta = {x: 5};
    var called = 0;

    logger.on('logging', function (transport, level, msg, meta) {
        ok(transport.name === 'memory' || transport.name === 'console');
        equal(level, 'info', 'level submitted to event');
        equal(msg, logMsg, 'message submitted to event');
        deepEqual(meta, logMeta, 'meta data submitted to even');
        called++;
        if (called === 2) start();
    });

    logger.info(logMsg, logMeta);
});

asyncTest('error event handler should be called when logging with unknown log level', function () {
    var logger = new winston.Logger({
        transports: [
                     new (winston.transports.Memory)()
                     ]
    });
    var logMsg = 'abc';

    logger.on('error', function (err) {
        ok(true, 'error handler called');
        start();
    });

    logger.emitErrs = true;
    logger.log('xLevel', logMsg);
});

asyncTest('log method should be called after all transports have logged', function () {
    var logger = new winston.Logger({
        transports: [
                     new (winston.transports.Memory)(),
                     new (winston.transports.Console)()
                     ]
    });
    var logMsg = 'abc';
    var logMeta = {x: 5};

    logger.info(logMsg, logMeta, function (err, level, msg, meta) {
        equal(level, 'info', 'level submitted to log handler');
        equal(msg, logMsg, 'message submitted log handler');
        deepEqual(meta, logMeta, 'meta data submitted to log handler');
        start();
    });
});

//==========================================================================
QUnit.module('winston.multipleLoggers');
//==========================================================================

asyncTest('handle multiple loggers in winston default container', function () {
    winston.loggers.add('category1', {
        console: {
            silent: true,
        },
        memory: {}
    });
    winston.loggers.add('category2', {
        console: {
            silent: true,
        }
    });

    var cat1Logger = winston.loggers.get('category1');
    var cat2Logger = winston.loggers.get('category2');
    var cat1Called = 0;
    var cat2Called = 0;
    var started = false;

    cat1Logger.on('logging', function (transport, level, msg, meta) {
        cat1Called++;
        if (!started && cat1Called === 2 && cat2Called === 1) {
            started = true;
            ok(true);
            start();
        }
    });
    cat2Logger.on('logging', function (transport, level, msg, meta) {
        cat2Called++;
        if (!started && cat1Called === 2 && cat2Called === 1) {
            started = true;
            ok(true);
            start();
        }
    });

    cat1Logger.log('warn', 'warn message');
    cat2Logger.info('info message');
});

asyncTest('handle multiple loggers in own container', function () {
    var loggerContainer = new winston.Container();

    loggerContainer.add('category1', {
        console: {
            silent: true,
        },
        memory: {}
    });
    loggerContainer.add('category2', {
        console: {
            silent: true,
        }
    });

    var cat1Logger = loggerContainer.get('category1');
    var cat2Logger = loggerContainer.get('category2');
    var cat1Called = 0;
    var cat2Called = 0;
    var started = false;

    cat1Logger.on('logging', function (transport, level, msg, meta) {
        cat1Called++;
        if (!started && cat1Called === 2 && cat2Called === 1) {
            started = true;
            ok(true);
            start();
        }
    });
    cat2Logger.on('logging', function (transport, level, msg, meta) {
        cat2Called++;
        if (!started && cat1Called === 2 && cat2Called === 1) {
            started = true;
            ok(true);
            start();
        }
    });

    cat1Logger.log('warn', 'warn message');
    cat2Logger.info('info message');
});

//==========================================================================
QUnit.module('winston.sharedTransports', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('shared transport should contain log messages of all loggers', function () {
    var loggerContainer = new winston.Container({
        transports: [ new (winston.transports.Console)() ]
    });

    loggerContainer.add('category1');
    loggerContainer.add('category2');

    var cat1Logger = loggerContainer.get('category1');
    var cat2Logger = loggerContainer.get('category2');

    cat1Logger.log('warn', 'warn message');
    cat2Logger.info('info message');
    
    ok(this.consoleLogSpy.calledTwice);
});

//==========================================================================
QUnit.module('winston.extendObjectWithLogging', {
//  ========================================================================
    setup: function () {
        this.consoleLogSpy = sinon.spy();
        this.origConsoleLog = console.log;
        console.log = this.consoleLogSpy;
    },
    teardown: function () {
        // Reset console.log
        console.log = this.origConsoleLog;
    }
});

test('extended object should log', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger({
        transports: [new (winston.transports.Console)()]
    });
    var myObject = {};

    logger.extend(myObject);
    
    myObject.info(logMsg);
    ok(this.consoleLogSpy.called, 'console.log called');
});
