'use strict';

var path = require('path');

module.exports = {
  plugins: {
    appWsforwarder: {
      enabled: true,
      specialEvents: {
        error: {
          name: 'ERROR'
        },
        failed: {
          name: 'ERROR'
        },
        invalid: {
          name: 'ERROR'
        },
        timeout: {
          name: 'TIMEOUT'
        }
      },
      mappingStore: path.join(__dirname, '../lib/mappings/demo')
    }
  }
};
