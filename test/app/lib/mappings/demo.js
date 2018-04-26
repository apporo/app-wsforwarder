module.exports = {
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
}