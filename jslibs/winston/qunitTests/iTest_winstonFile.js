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

var workDir = 'jslibs/winston/qunitTests/testResult';
var logFileBaseName = 'logfile';
var logFileExt = 'log';
var logFilePath = workDir + '/' + logFileBaseName + '.' + logFileExt;

function cleanUpWorkDir () {
    var logFiles = vertx.fileSystem.readDirSync(workDir,
            logFileBaseName + '\\d*\\.' + logFileExt);
    for (var i = 0; i < logFiles.length; i++) {
        vertx.fileSystem.deleteSync(logFiles[i]);
    }
}

//==========================================================================
QUnit.module('winston.File.Basic', {
//  ========================================================================
    teardown: function () {
        cleanUpWorkDir();
    }
});

asyncTest('should log a single line', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger();

    logger.add(winston.transports.File, { filename: logFilePath });

    logger.info(logMsg);
    logger.close();

    vertx.setTimer(500, function () {
        var fileContents = vertx.fileSystem.readFileSync(logFilePath);
        
        equal(JSON.parse(fileContents.toString()).message, logMsg, 'Message logged');
        equal(JSON.parse(fileContents.toString()).level, 'info', 'Message logged with correct level');
        ok(JSON.parse(fileContents.toString()).hasOwnProperty('timestamp') );

        start();
    });
});

asyncTest('should write multiple files with maxsize option', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger();
    var noOfFiles = 5;

    logger.add(winston.transports.File, { filename: logFilePath, maxsize: 10 });

    var i = 0;
    var timerId = vertx.setPeriodic(250, function () {
        logger.info(logMsg + i++);
        
        if (i >= noOfFiles) {
            vertx.cancelTimer(timerId);
            logger.close();
            
            vertx.setTimer(500, function () {
                var logFiles = vertx.fileSystem.readDirSync(workDir,
                        logFileBaseName + '\\d*\\.' + logFileExt);

                equal(logFiles.length, noOfFiles, 'Multiple files written');
                
                start();
            });
        }
    });
});

asyncTest('should write multiple files with maxsize and maxFiles option', function () {
    var logMsg = 'abc';
    var logger = new winston.Logger();
    var noOfFiles = 5;
    var maxNoOfFiles = 3;

    logger.add(winston.transports.File, { filename: logFilePath, maxsize: 10, maxFiles: maxNoOfFiles });

    var i = 0;
    var timerId = vertx.setPeriodic(250, function () {
        logger.info(logMsg + i++);
        
        if (i >= noOfFiles) {
            vertx.cancelTimer(timerId);
            logger.close();
            
            vertx.setTimer(500, function () {
                var logFiles = vertx.fileSystem.readDirSync(workDir,
                        logFileBaseName + '\\d*\\.' + logFileExt);

                equal(logFiles.length, maxNoOfFiles, 'Max no of files written');
                
                start();
            });
        }
    });
});
