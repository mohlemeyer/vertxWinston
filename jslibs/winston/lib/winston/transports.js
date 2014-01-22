/*
 * transports.js: Set of all transports Winston knows about
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 *
 */
var console = require('vertx/console');
//var fs = require('vertx').fileSystem;
    // path = require('path'),
var common = require('./common');

var transports = exports;

//
// Setup all transports as lazy-loaded getters.
//
['console.js', 'file.js', 'memory.js', 'eb-mail.js', 'eb-mongo.js'].forEach(function (file) {
  var transport = file.replace('.js', ''),
      name  = common.capitalize(transport);

  if (transport === 'transport') {
    return;
  }
  else if (~transport.indexOf('-')) {
    name = transport.split('-').map(function (part) {
      return common.capitalize(part);
    }).join('');
  }

  transports.__defineGetter__(name, function () {
    return require('./transports/' + transport)[name];
  });
});