module.exports = {
  publishers: {
    "fibonacci": {
      serviceName: "application/example",
      methodName: "fibonacci",
      transformRequest: function(data) {
        return data;
      },
      transformResponse: function(data) {
        return data;
      }
    }
  },
  broadcasts: {
    "inbox-updater": {
      serviceName: "application/example",
      subscriberName: "inboxUpdater"
    }
  }
}