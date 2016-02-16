var Firebase = require("firebase");
var rootRef = new Firebase(process.env.FIREBASE_URL);

const TRADE_ALTER = 0.25;

var stockPrice = 0;
rootRef.child('price').on('value', function(data) {

  stockPrice = data.val();
});

this.buy = function(wallet) {
  updatePrice(stockPrice - TRADE_ALTER);
  wallet.bal -= stockPrice;
  wallet.stock++;
}

this.sell = function(wallet) {
  if (wallet.stock <= 0) {
    return;
  }
  updatePrice(stockPrice + TRADE_ALTER);
  wallet.bal += stockPrice;
  wallet.stock--;
}

this.getStockPrice = function() {
  return stockPrice;
};

function updatePrice(newPrice) {
  rootRef.child('price').set(newPrice);
}
