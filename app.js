var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var session = require('client-sessions');

app.use(bodyParser.json());

app.use(session({
  cookieName: 'wallet',
  secret: process.env.SESSION_KEY,
  duration: 100 * 24 * 60 * 60 * 1000, // 100 days
  activeDuration: 100 * 24 * 60 * 60 * 1000,
}));

app.get('/', function(req, res){
  res.send('Hello World');
});

var server = app.listen(process.env.PORT, function() {
 console.log('Listening on port %d', server.address().port);
});
