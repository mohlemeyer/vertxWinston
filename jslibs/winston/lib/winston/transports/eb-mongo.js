/*
 * eb-mongo.js: Transport for logging to MongoDB via the event bus
 *
 * (C) 2014 Matthias Ohlemeyer
 * 
 * MIT LICENCE
 */

var util = require('jslibs/winston/thirdPartyDeps/nodejs/util/util'),
Transport = require('./transport').Transport,
vertx = require('vertx');

var validWriteConcerns = {
        "ACKNOWLEDGED": 1,
        "ERRORS_IGNORED": 1,
        "FSYNC_SAFE": 1,
        "FSYNCED": 1,
        "JOURNAL_SAFE": 1,
        "JOURNALED": 1,
        "MAJORITY": 1,
        "NONE": 1,
        "NORMAL": 1,
        "REPLICA_ACKNOWLEDGED": 1,
        "REPLICAS_SAFE": 1,
        "SAFE": 1,
        "UNACKNOWLEDGED": 1
};

/**
 * Constructor for the Vert.x event bus MongoDb transport.<br>
 * <br>
 * 
 * @param {object} options Options for this instance.
 * @param {string} options.ebAddress Event bus address of the mongo persistor
 * module.
 * @param {string} [options.collection=logs] Collection for storing logs.
 * @param {boolean} [options.writeConcern=SAFE] Mongo write concern for storing 
 * log messages, which overwrites the driver's default setting. Valid values
 * are "NONE", "NORMAL", "SAFE", "MAJORITY", "FSYNC_SAFE", "JOURNAL_SAFE"
 * and "REPLICAS_SAFE". See the MongoDb Java Driver API for a detailed
 * description.
 * 
 * @constructor
 */
var EbMongo = exports.EbMongo = function (options) {    
    Transport.call(this, options);
    options = options || {};
    
    if (!options.ebAddress) {
        throw new Error('Event bus address of mongodb module required');
    }

    this.ebAddress = options.ebAddress;
    this.collection = options.collection || 'logs';
    if (options.writeConcern) {
        if (options.writeConcern in validWriteConcerns) {
            this.writeConcern = options.writeConcern;
        } else {
            throw new Error('Invalid write concern for logging to MongoDb ' +
                    'specified');
        }
    }  
};

//Inherit from `winston.Transport`.
util.inherits(EbMongo, Transport);

//Expose the name of this Transport on the prototype
EbMongo.prototype.name = 'ebMongo';

/**
 * Core logging method exposed to Winston.<br>
 * <br>
 * 
 * @param {string} level Level at which to log the message.
 * @param {string} msg Message to log.
 * @param {Object} meta Additional metadata to attach.
 * @param {function} callback Continuation to respond to when complete.
 */
EbMongo.prototype.log = function (level, msg, meta, callback) {
    var self = this,
    entry,
    dbCmd;

    if (this.silent) {
        return callback(null, true);
    }

    entry = {};
    entry.timestamp = new Date();
    entry.level = level;
    entry.message = msg;
    entry.name = this.name;
    if (meta) {
        entry.meta = meta;
    }

    dbCmd = {
            action: 'save',
            collection: this.collection,
            document: entry
    };
    if (this.writeConcern) {
        dbCmd.writeConcern = this.writeConcern;
    }
    
    vertx.eventBus.send(this.ebAddress, dbCmd, function (reply) {
        if (reply.status === 'error') {
            self.emit('error', reply.message);
        } else if (reply.status !== 'ok') {
            self.emit('error', 'Unknown reply status');
        } else {
            self.emit('logged');
        }
        callback(null, true);
    });
};

/**
 * Query the transport.<br>
 * <br>
 * @param {object} [options] Query options for this instance.
 * @param {function} callback Continuation to respond to when complete.
 * 
 * Code inspired by, in parts copied from, winston-mongodb
 * (see https://github.com/indexzero/winston-mongodb).
 */
EbMongo.prototype.query = function (options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var options = this.normalizeQuery(options),
    dbCmd,
    entries;
    
    dbCmd = {
            action: 'find',
            collection: this.collection,
            matcher: {
                timestamp: {
                    $gte: options.from,
                    $lte: options.until
                }
            },
            keys: {
                _id: 0
            },
            skip: options.start,
            limit: options.rows,
            sort: { timestamp: options.order === 'desc' ? -1 : 1 }
    };

    entries = [];

    function replyHandler(reply, replier) {
        if (reply.status === 'error') {
            callback(reply.message);
        }  else {
            entries = entries.concat(reply.results);
            if (reply.status === 'more-exist') {
                replier({}, replyHandler);
            } else {
                callback(null, entries);
            }
        }       
    }
    
    vertx.eventBus.send(this.ebAddress, dbCmd, replyHandler);
};