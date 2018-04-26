'use strict';

var Loadsync = require('loadsync');
var lodash = require('devebot').require('lodash');

var socket = require('socket.io-client')('http://127.0.0.1:7979', {
  'force new connection': true,
  reconnect: true
});

var demoData = [
  {
    name: 'fibonacci',
    data: {
      number: 34
    }
  },
  {
    name: 'fibonacci',
    data: {
      number: 35
    }
  },
  {
    name: 'fibonacci',
    data: {
      number: 50
    }
  }
]

demoData = demoData.map(function(item, idx) {
  item.data.actionId = lodash.padStart(idx, 6, '0');
  return item;
});

var loadsync = new Loadsync([{
  name: 'NO_TIMEOUT',
  cards: lodash.map(demoData, function(item) {
    return item.data.actionId
  })
}]);

loadsync.ready(function(info) {
  socket.close();
}, 'NO_TIMEOUT');

socket.on('connect', function() {
  socket.on('fibonacci', function(info) {
    var actionId = info.actionId;
    console.log('Result of %s: %s', actionId, JSON.stringify(info, null, 2));
    loadsync.check(actionId, 'NO_TIMEOUT');
  });
  lodash.forEach(demoData, function(descriptor) {
    socket.emit(descriptor.name, descriptor.data);
  });
});
