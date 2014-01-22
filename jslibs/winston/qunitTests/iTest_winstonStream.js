/**
 * QUnit tests for the winston file transport.
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

//IMPORTANT: Turn the vertx net socket into a node event emitter
//before any socket, which is passed to winston as a stream is instantiated.
var events = require('jslibs/winston/thirdPartyDeps/eventemitter2/eventemitter2');
var util = require('jslibs/winston/thirdPartyDeps/nodejs/util/util');
util.inherits(vertx.net.NetSocket, events.EventEmitter);

//Stop QUnit execution
stop();

//Setup a simple tcp server, which logs it's input to the console
var portNo = 1234; // Port number to use for server and client
var netClient;
var netSocket;
var netServer = vertx.createNetServer();
netServer.connectHandler(function(serverSock) {
    serverSock.dataHandler(function(buffer) {
        console.log(buffer.toString());
    });
    serverSock.closeHandler(function() {        
        netServer.close();
    });
    serverSock.exceptionHandler(function(ex) {        
        console.error('ERROR (server socket): ' + ex.getMessage());            
    });
}).listen(portNo, 'localhost', function () {
    console.log('Net server listening...');

    // Set up a simple tcp client; the socket will be used as stream for winston
    netClient = vertx.createNetClient();
    netClient.connect(portNo, 'localhost', function(err, clientSock) {
        if (!err) {
            console.log('Net client connected...');
            netSocket = clientSock;
            // (Re-)start QUnit execution
            start();
        } else {
            console.log('ERROR (client socket): Could not connect net client');
        }
    });
});

//==========================================================================
QUnit.module('winston.File.Stream', {
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

asyncTest('JSON logging to net socket', function () {
    var self = this;
    var logMsg = 'abc';
    var logger = new winston.Logger({
        transports: [new (winston.transports.File)({
            stream: netSocket
        })]
    });

    logger.info(logMsg);
    vertx.setTimer(1000, function () {
        var logEntry = JSON.parse(self.consoleLogSpy.firstCall.args[0]);
        equal(logEntry.level, 'info');
        equal(logEntry.message, logMsg);

        start();
    });
});

asyncTest('JSON logging to net socket from level', function () {
    var self = this;
    var logMsg = 'abc';
    var logger = new winston.Logger({
        transports: [new (winston.transports.File)({
            stream: netSocket,
            level: 'warn'
        })]
    });

    logger.info(logMsg);
    vertx.setTimer(500, function () {
        equal(self.consoleLogSpy.callCount, 0, 'logger not called');
        
        logger.warn(logMsg);
        vertx.setTimer(1000, function () {
            equal(self.consoleLogSpy.callCount, 1, 'logger called once');
            
            start();
        });
    });
});

