var express = require('express');
var app = express();
var server;

app.get('/', function(req, res){
  res.send('Hello World');
});

server = app.listen(3000, function() {
 console.log('Listening on port %d', server.address().port);
});
