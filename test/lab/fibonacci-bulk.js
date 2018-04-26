'use strict';

var async = require('async');
var Promise = require('bluebird');
var lodash = require('lodash');
var socketioClient = require('socket.io-client');

var TOTAL = 1000;

var openSocket = function(index, total) {
  var socket = socketioClient('http://127.0.0.1:7979', {
    'force new connection': true,
    reconnect: true
  });

  var total = total || 200;

  var cards = lodash.map(lodash.range(total), function(idx) {
    return lodash.padStart(idx, 6, '0');
  });

  var send = function(args) {
    args = args || {};
    let { total, chunk, delay, min, max } = args;
    min = min || 10;
    max = max || 40;
    delay = delay || 1000;
    var loop = 0;
    var count = 0;
    var remain = total;
    async.whilst(function() {
      return remain > 0;
    }, function(next) {
      var list = [];
      var n = (remain < chunk) ? remain : chunk;
      remain = remain - n;
      loop += 1;
      for(var i=0; i<n; i++) {
        var item = { data: {} };
        item.name = 'fibonacci';
        item.data.number = lodash.random(min, max);
        item.data.actionId = lodash.padStart(count, 6, '0');
        list.push(item);
        count += 1;
      }
      lodash.forEach(list, function(descriptor) {
        socket.emit(descriptor.name, descriptor.data);
      });
      console.log('Count: %s', count);
      setTimeout(function() {
        next();
      }, delay);
    }, function (err, n) {
      console.log(' + stop after: %s (steps), remain: %s', loop, JSON.stringify(cards));
    });
  }

  socket.on('connect', function() {
    var received = 0;
    socket.on('ERROR', function(info) {
      console.log('=== ERROR: %s', JSON.stringify(info));
      received++;
    });
    socket.on('TIMEOUT', function(info) {
      console.log('=== TIMEOUT: %s', JSON.stringify(info));
      received++;
    });
    ['fibonacci'].forEach(function(methodId) {
      socket.on(methodId, function(info) {
        var actionId = info.actionId;
        console.log('Result of %s(%s): %s', methodId, actionId, JSON.stringify(info));
        received++;
        if (cards.length < 10) {
          console.log('Remain: %s', JSON.stringify(cards));
        }
        var actionIndex = cards.indexOf(actionId);
        if (actionIndex >= 0) cards.splice(actionIndex, 1);
        if (received >= total) {
          console.log('Completed: %s', JSON.stringify(cards));
          socket.close();
        }
      });
    });
    setTimeout(function() {
      send({
        total: total, chunk: 100, delay: 100, min: 10, max: 50
      });
    }, 2000);
  });
}

for(var i=0; i<10; i++) {
  openSocket(i, TOTAL);
}
