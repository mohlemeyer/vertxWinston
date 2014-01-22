/*
 * eb-mail.js: Transport sending logging emails via the Vert.x event bus
 *
 * (C) 2014 Matthias Ohlemeyer
 * 
 * MIT LICENCE
 */

var util = require('jslibs/winston/thirdPartyDeps/nodejs/util/util'),
_ = require('jslibs/winston/thirdPartyDeps/underscore/underscore'),
Transport = require('./transport').Transport,
vertx = require('vertx');

/**
 * Constructor for the Vert.x event bus mail transport.<br>
 * <br>
 * @param {object} options Options for this instance.
 * @param {string} options.ebAddress Event bus address of the mailer module.
 * @param {string} options.from Default sender email address; can be
 * overwritten in a log call via metadata.
 * @param {string|array} options.to Default receiver email address as a string
 * or an array of strings for multiple receivers; can be overwritten in a log
 * call via metadata.
 * @param {string|array} [options.cc] Default CC receiver email address as a
 * string or an array of strings for multiple CC receivers; can be overwritten
 * in a log call via metadata.
 * @param {boolean} [options.allowLogOverride] If set to "true" the "from",
 * "to" and "cc" email addresses can be overridden by metadata values in
 * individual log calls.
 * @param {string} [options.subject] Subject template. Leave empty for a
 * default template containing the logger name and log level.
 * 
 * @constructor
 */
var EbMail = exports.EbMail = function (options) {
    var subjTemplDefault = '<%= name %> [<%= level %>]: <%= message %>';
    var subjTempl;
    var bodyTemplDefault = '<%= name %>\n' +
    '\n' +
   'Level     : <%= level %>\n' +
   'Date/Time : <%= timestamp %>\n' +
   'Message   : <%= message %>\n' +
   '\n' +
   '<%= metaStringified %>';
    var bodyTempl;
    
    Transport.call(this, options);
    options = options || {};

    if (!options.ebAddress) {
        throw new Error('Event bus address of mailer module required');
    }

    this.ebAddress = options.ebAddress;
    this.from = options.from || undefined;
    this.to = options.to || undefined;
    this.cc = options.cc || undefined;
    this.allowLogOverride  = options.allowLogOverride || false;
    this.timestampFn = typeof options.timestampFn === 'function' ?
            options.timestampFn :
                function () {
                return new Date().toISOString();
            };
    
    subjTempl = options.subjTempl || subjTemplDefault;
    this.subjCompiled = _.template(subjTempl);
    bodyTempl = options.bodyTempl || bodyTemplDefault;
    this.bodyCompiled = _.template(bodyTempl);
};

//Inherit from `winston.Transport`.
util.inherits(EbMail, Transport);

//Expose the name of this Transport on the prototype
EbMail.prototype.name = 'ebMail';

/**
 * Core logging method exposed to Winston.<br>
 * <br>
 * @param {string} level Level at which to log the message.
 * @param {string} msg Message to log.
 * @param {Object} meta Additional metadata to attach. If the
 * "allowLogOverride" option is set to "true" for this instance then the
 * "from", "to" and "cc" values of the logger instance can be overridden by
 * same named properties in an individual log call. In this case these
 * properties will not be logged with the metadata.
 * @param {function} callback Continuation to respond to when complete.
 */
EbMail.prototype.log = function (level, msg, meta, callback) {
    var email,
    fields,
    metaIsEmpty,
    k,
    self = this;

    if (this.silent) {
        return callback(null, true);
    }

    email = {
            from: (this.allowLogOverride && meta && meta.from) ? meta.from :
                (this.from || undefined),
            to: (this.allowLogOverride && meta && meta.to) ? meta.to :
                (this.to || undefined),
            cc: (this.allowLogOverride && meta && meta.cc) ? meta.cc :
                (this.cc || undefined),
    };

    if (!email.from || !email.to) {
        this.emit('error', 'ebMail: Message not sent: "from" and "to" ' +
        'addresses required');
        callback(null, true);
        return;
    }

    if (this.allowLogOverride && meta) {
        try {
            delete meta.from;
            delete meta.to;
            delete meta.cc;
        } catch (ignore) {}
    }
    
    metaIsEmpty = true;
    if (meta) {
        for (k in meta) {
            metaIsEmpty = false;
            break;
        }
    }
    
    fields = meta ? _.clone(meta) : {};
    fields.timestamp = this.timestampFn();
    fields.metaStringified = metaIsEmpty ? '' : JSON.stringify(meta, null, 4);
    fields.name = this.name;
    fields.level = level;
    fields.message = msg;
    
    email.subject = this.subjCompiled(fields);
    email.body = this.bodyCompiled(fields);

    vertx.eventBus.send(this.ebAddress, email, function (reply) {
        if (reply.errorMsg) {
            self.emit('error', reply.errorMsg);
        } else {
            self.emit('logged');
        }
    });
    
    // Return immediately after putting the message on the event bus
    callback(null, true);
};