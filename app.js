var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var session = require('client-sessions');
var game = require(__dirname + '/game');

app.use(bodyParser.json());

app.use(session({
  cookieName: 'wallet',
  secret: process.env.SESSION_KEY,
  duration: 100 * 24 * 60 * 60 * 1000, // 100 days
  activeDuration: 100 * 24 * 60 * 60 * 1000,
}));

app.use(function(req, res, next) {
  if (req.wallet == undefined || req.wallet.bal == undefined) {
    req.wallet.bal = game.getStockPrice() * 5;
    req.wallet.stock = 0;
  }
  next();
});

app.get('/', function(req, res){
  res.sendfile(__dirname + '/index.html');
});

app.post('/reset', function(req, res) {
  req.wallet = {};
  res.send("OK");
});

app.get('/price', function(req, res) {
  res.json({
    "price": game.getStockPrice()
  });
});

app.get('/stats', function(req, res) {
  var statObj = {
    "user": req.wallet,
    "market": {
      "price": game.getStockPrice()
    }
  }
  res.json(statObj);
});

app.post('/buy', function(req, res) {
  game.buy(req.wallet);
  res.json(req.wallet);
});

app.post('/sell', function(req, res) {
  game.sell(req.wallet);
  res.json(req.wallet);
});

var server = app.listen(process.env.PORT, function() {
 console.log('Listening on port %d', server.address().port);
});
