/**
 * QUnit integration tests for the event bus mailer module in winston core.
 * 
 * Copyright (c) 2014 Matthias Ohlemeyer
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

var mailerEbAddress = 'mailer';
var mailHandlerSpy = sinon.spy();

var loggerFrom = 'John Doe <jd@email.zzz>';
var loggerTo = 'Max Mustermann <mm@email.yyy>';
var loggerCc = 'S. Suhrbier <sb@email.zyz>';
var logFrom = 'Doe John <jd@email.zzz>';
var logTo = 'Mustermann Max <nn@email.yyy>';
var logCc = 'Sabine S. <bs@email.<zyz>';
var level = 'info';
var logMsg1 = 'abc';
var defaultLoggerName = 'ebMail';
var customLoggerName = 'MyEbLogger';

vertx.eventBus.registerHandler(mailerEbAddress, mailHandlerSpy);

//==========================================================================
QUnit.module('winston.EventBusMailer', {
//  ========================================================================
    teardown: function () {
        mailHandlerSpy.reset();
    }
});

test('should throw when no event bus address specified', function () {
    var logger = new winston.Logger();

    throws(function () {
        logger.add(winston.transports.EbMail, {
            from: loggerFrom,
            to: [loggerTo],
            cc: loggerCc
        });
    }, 'Throws without event bus address');
});
asyncTest('should emit "error" if "from" address not present', function () {
    var logger = new winston.Logger();

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        to: [loggerTo]
    });

    logger.emitErrs = true;
    logger.on('error', function (err) {
        ok(true, 'Error emitted');
        start();
    });

    logger[level](logMsg1);
    logger.close();
});
asyncTest('should emit "error" if "to" address not present', function () {
    var logger = new winston.Logger();

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        from: loggerFrom
    });

    logger.emitErrs = true;
    logger.on('error', function (err) {
        ok(true, 'Error emitted');
        start();
    });

    logger[level](logMsg1);
    logger.close();
});
asyncTest('should emit the "logging" event immediately', function () {
    var logger = new winston.Logger();

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        from: loggerFrom,
        to: [loggerTo]
    });
    
    logger.on('logging', function (transport, level, msg, meta) {
        // Timer only needed to prevent QUnit timing problems with the
        // subsequent test.
        vertx.setTimer(100, function () {
            ok(true, '"logging" event emitted');
            start();     
        });
    });

    logger[level](logMsg1);
    logger.close();    
});
asyncTest('should call the mail handler with from and to addresses', function () {
    var logger = new winston.Logger();
    var arg;

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc
    });
    
    ok(!mailHandlerSpy.called, 'Mail handler not called before log');
    
    logger[level](logMsg1);
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mailHandlerSpy.calledOnce, 'Mail handler called once after log');
        arg = mailHandlerSpy.firstCall.args[0];
        
        // Addresses
        equal(arg.from, loggerFrom, '"From" address correctly submitted');
        equal(arg.to, loggerTo, '"To" address correctly submitted');
        equal(arg.cc, loggerCc, '"CC" address correctly submitted');
        
        // Contents
        ok(arg.subject.indexOf(logMsg1) > -1, 'Subject contains message');
        ok(arg.subject.indexOf(level) > -1, 'Subject contains level');
        ok(arg.subject.indexOf(defaultLoggerName) > -1, 'Subject contains default logger name');
        
        ok(arg.body.indexOf(logMsg1) > -1, 'Body contains message');
        ok(arg.body.indexOf(level) > -1, 'Body contains message');
        ok(arg.body.indexOf(defaultLoggerName) > -1, 'Body contains default logger name');
        
        start();
    });
});
asyncTest('should not override from and to address in log call', function () {
    var logger = new winston.Logger();
    var arg;

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc
    });
    
    logger[level](logMsg1, {
        from: logFrom,
        to: logTo,
        cc: logCc
    });
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mailHandlerSpy.calledOnce, 'Mail handler called once after log');
        arg = mailHandlerSpy.firstCall.args[0];
        
        // Addresses
        equal(arg.from, loggerFrom, '"From" address correctly submitted from logger');
        equal(arg.to, loggerTo, '"To" address correctly submitted from logger');
        equal(arg.cc, loggerCc, '"CC" address correctly submitted from logger');
        
        // Log call addresses in body
        ok(arg.body.indexOf(logFrom) > -1, 'Body contains "from" address from log call');
        ok(arg.body.indexOf(logTo) > -1, 'Body contains "to" address from log call');
        ok(arg.body.indexOf(logCc) > -1, 'Body contains "CC" address from log call');
        
        start();
    });
});
asyncTest('should override from and to address in log call', function () {
    var logger = new winston.Logger();
    var arg;

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc,
        allowLogOverride: true
    });
    
    logger[level](logMsg1, {
        from: logFrom,
        to: logTo,
        cc: logCc
    });
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mailHandlerSpy.calledOnce, 'Mail handler called once after log');
        arg = mailHandlerSpy.firstCall.args[0];
        
        // Addresses
        equal(arg.from, logFrom, '"From" address correctly submitted from log call');
        equal(arg.to, logTo, '"To" address correctly submitted from log call');
        equal(arg.cc, logCc, '"CC" address correctly submitted from log call');
        
        // Log call addresses in body
        equal(arg.body.indexOf(logFrom), -1, 'Body does not contain "from" address from log call');
        equal(arg.body.indexOf(logTo), -1, 'Body does not contain "to" address from log call');
        equal(arg.body.indexOf(logCc), -1, 'Body does not contain "to" address from log call');
        
        start();
    });
});
asyncTest('should log with custom logger name', function () {
    var logger = new winston.Logger();
    var arg;

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        name: customLoggerName,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc
    });
    
    logger[level](logMsg1);
    logger.close();
    
    vertx.setTimer(50, function () {
        arg = mailHandlerSpy.firstCall.args[0];
        
        ok(arg.body.indexOf(customLoggerName) > -1, 'Body contains custom logger name');
        
        start();
    });
});
asyncTest('should log with templates', function () {
    var logger = new winston.Logger();
    var arg;

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        name: customLoggerName,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc,
        subjTempl: '<%= level %>',
        bodyTempl: '<%= message %>'
    });
    
    logger[level](logMsg1);
    logger.close();
    
    vertx.setTimer(50, function () {
        arg = mailHandlerSpy.firstCall.args[0];
        
        equal(arg.subject, level, 'Subject contains "level" info');
        equal(arg.body, logMsg1, 'Body contains message');
        
        start();
    });
});
asyncTest('should log with custom timestamp function', function () {
    var logger = new winston.Logger();
    var arg;
    var timestampReturn = '2014-01-01';

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        name: customLoggerName,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc,
        bodyTempl: '<%= timestamp %>',
        timestampFn: function () {
            return timestampReturn;
        }
    });
    
    logger[level](logMsg1);
    logger.close();
    
    vertx.setTimer(50, function () {
        arg = mailHandlerSpy.firstCall.args[0];
        
        equal(arg.body, timestampReturn, 'Custom timestamp logged');
        
        start();
    });
});
asyncTest('should log metadata', function () {
    var logger = new winston.Logger();
    var arg;
    var metaValue = 'val';

    logger.add(winston.transports.EbMail, {
        ebAddress: mailerEbAddress,
        name: customLoggerName,
        from: loggerFrom,
        to: [loggerTo],
        cc: loggerCc,
        bodyTempl: '<%= prop %>',
    });
    
    logger[level](logMsg1, { prop: metaValue} );
    logger.close();
    
    vertx.setTimer(50, function () {
        arg = mailHandlerSpy.firstCall.args[0];
        
        equal(arg.body, metaValue, 'Metadata logged');
        
        start();
    });
});