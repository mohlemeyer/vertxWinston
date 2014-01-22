/**
 * QUnit integration tests for the MongoDb logger module in winston core.
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

var mongoPersistorEbAddress = 'mongoPersistorModAdr';
var mongoPersistorHandlerSpy = sinon.spy();

var level = 'info';
var logMsg1 = 'abc';
var defaultLoggerName = 'ebMongo';
var customLoggerName = 'MyMongoEbLogger';

vertx.eventBus.registerHandler(mongoPersistorEbAddress,
        mongoPersistorHandlerSpy);

//==========================================================================
QUnit.module('winston.EventBusMongoTransport', {
//  ========================================================================
    teardown: function () {
        mongoPersistorHandlerSpy.reset();
    }
});

test('should throw when no event bus address specified', function () {
    var logger = new winston.Logger();

    throws(function () {
        logger.add(winston.transports.EbMongo, {
            collection: 'logEntries',
            writeConcern: 'NONE'
        });
    }, 'Throws without event bus address');
});
test('should throw on invalid MongoDb write concern', function () {
    var logger = new winston.Logger();

    throws(function () {
        logger.add(winston.transports.EbMongo, {
            ebAddress: mongoPersistorModAdr,
            collection: 'logEntries',
            writeConcern: 'XYZ'
        });
    }, 'Throws without event bus address');
});
asyncTest('should call the MongoDb persistor handler with default values on "log"', function () {
    var logger = new winston.Logger();
    var dbCommand;

    logger.add(winston.transports.EbMongo, {
        ebAddress: mongoPersistorEbAddress
    });
    
    ok(!mongoPersistorHandlerSpy.called, 'MongoDb persistor handler not called before log');
    
    logger[level](logMsg1);
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mongoPersistorHandlerSpy.calledOnce, 'Mail handler called once after log');
        
        dbCommand = mongoPersistorHandlerSpy.firstCall.args[0];
        
        equal(dbCommand.action, 'save', '"save" command sent');
        equal(dbCommand.collection, 'logs', 'logging to default collection');
        equal(dbCommand.document.level, level, 'logging with given level');
        equal(dbCommand.document.message, logMsg1, 'logging with given message');
        equal(dbCommand.document.name, defaultLoggerName, 'logging with default logger name');

        start();
    });
});
asyncTest('should call the MongoDb persistor handler with custom values on "log"', function () {
    var logger = new winston.Logger();
    var dbCommand;

    var collectionName = 'logEntries';
    var writeConcernName = 'NONE';
    var metaPropertyName = 'x';
    var metaPropertyValue = 'x_val';
    var meta = {};
    meta[metaPropertyName] = metaPropertyValue;
    
    logger.add(winston.transports.EbMongo, {
        name: customLoggerName,
        ebAddress: mongoPersistorEbAddress,
        collection: collectionName,
        writeConcern: writeConcernName
    });
    
    ok(!mongoPersistorHandlerSpy.called, 'MongoDb persistor handler not called before log');
    
    logger[level](logMsg1, meta);
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mongoPersistorHandlerSpy.calledOnce, 'Mail handler called once after log');
        
        dbCommand = mongoPersistorHandlerSpy.firstCall.args[0];
        
        equal(dbCommand.collection, collectionName, 'logging to custom collection');
        equal(dbCommand.writeConcern, writeConcernName, 'logging with custom write concern');
        equal(dbCommand.document.meta[metaPropertyName], metaPropertyValue, 'logging with meta property');
        equal(dbCommand.document.name, customLoggerName, 'logging with custom logger name');
        
        start();
    });
});
asyncTest('should call the MongoDb persistor handler with default values on "query"', function () {
    var logger = new winston.Logger();
    var dbCommand;

    logger.add(winston.transports.EbMongo, {
        ebAddress: mongoPersistorEbAddress
    });
    
    ok(!mongoPersistorHandlerSpy.called, 'MongoDb persistor handler not called before log');
    
    logger.query();
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mongoPersistorHandlerSpy.calledOnce, 'Mail handler called once after log');
        
        dbCommand = mongoPersistorHandlerSpy.firstCall.args[0];
        
        equal(dbCommand.action, 'find', '"find" command sent');
        equal(dbCommand.collection, 'logs', 'logging to default collection');
        equal(typeof dbCommand.matcher, 'object', 'db command has a matcher object');
        equal(dbCommand.keys._id, 0, 'leave out "_id" field from result');
        equal(dbCommand.sort.timestamp, -1, 'sort on "timestamp" field descending');

        start();
    });
});
asyncTest('should call the MongoDb persistor handler with custom values on "query"', function () {
    var logger = new winston.Logger();
    var dbCommand;

    var collectionName = 'logEntries';
    var dateFrom = new Date() - 1000;   // will produce a number (milliseconds
                                        // since epoch) which will be turned
                                        // into a Date object
    var dateUntil = new Date();
    var skipRows = 1;
    var noOfRows = 99;

    logger.add(winston.transports.EbMongo, {
        ebAddress: mongoPersistorEbAddress,
        collection: collectionName
    });
    
    ok(!mongoPersistorHandlerSpy.called, 'MongoDb persistor handler not called before log');
    
    logger.query({
        from: dateFrom,
        until: dateUntil,
        start: skipRows,
        rows: noOfRows,
        order: 'asc'
    });
    logger.close();
    
    vertx.setTimer(50, function () {
        ok(mongoPersistorHandlerSpy.calledOnce, 'Mail handler called once after log');
        
        dbCommand = mongoPersistorHandlerSpy.firstCall.args[0];
        
        equal(dbCommand.action, 'find', '"find" command sent');
        equal(dbCommand.collection, collectionName, 'Querying custom collection');
        equal(dbCommand.matcher.timestamp.$gte, (new Date(dateFrom)).toJSON(), 'Query with "from date"');
        equal(dbCommand.matcher.timestamp.$lte, dateUntil.toJSON(), 'Query with "until date"');
        equal(dbCommand.skip, skipRows, 'Skipping rows');
        equal(dbCommand.limit, noOfRows, 'Limiting rows');
        equal(dbCommand.sort.timestamp, 1, 'sort on "timestamp" field ascending');

        start();
    });
});
