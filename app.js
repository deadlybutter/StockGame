/* TODO LIST

- Break everything out into modules > everything

- StatHat 

*/

var express = require('express');
var app = express();
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var uriUtil = require('mongodb-uri');
var config = require(__dirname + '/config/app_config');

var server;

// DB+WEB SETUP

var dbOptions = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }, 
                replset: { socketOptions: { keepAlive: 1, connectTimeoutMS : 30000 } } };       
var mongodbUri = process.env.DB_URI || 'mongodb://' + config.db.username + ':' + config.db.password + '@ds063869.mongolab.com:63869/tradegame-staging';
var mongooseUri = uriUtil.formatMongoose(mongodbUri);

mongoose.connect(mongooseUri, dbOptions);
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
    console.log('Connected to DB');
    server = app.listen(3000, function() {
	   console.log('Listening on port %d', server.address().port);
    });
});


//GAME SETUP

/*
 * username Player username
 * stocks List of stock ID's the player currently owns
 * balance Players current balance
 */
var PlayerSchema = new Schema({
    username: String,
    apiKey: String,
    stocks: Array, 
    balance: Number
});


/*
 * Updates the player balance. Pass in negative change param. to subtract
 */
PlayerSchema.methods.updateBalance = function(change){
    this.balance += change;
}

var Player = mongoose.model('Player', PlayerSchema);
//var testPlayer = new Player({username: "test", stocks: [0, 1, 2, 3], balance: 100});
//testPlayer.save();

/*
 * id UUID given to each stock
 * company String containing the company name 
 * owner String containing the username of the owner
 */
var Stock = function(id, company, owner){
    this.id = id;
    this.company = company;
    this.owner = owner;
}

Stock.prototype.getValue = function(callback){
	getCompany(this.company, function onCompanyget(company){
       callback(company.value); 
    });
}

var HistoryValue = function(value){
    this.value = value;
    this.time = new Date().toISOString();
}

/*
 * name Name of company
 * symbol The unique letter symbol for this company
 * description String that describes what the company does
 * stocks Object containing all of the stocks for the company, key = id, value = stock object
 * value Dynamic integer representing the stock value
 * history Dataset containing the value history for this company
 */
var CompanySchema = new Schema({
    name: String,
    symbol: String,
    description: String,
    stocks: Array, 
    ownedStock: Number,
    value: Number, 
    history: Array
});

/*
 * Calculates the value of the stock
 * For initial computation / hard reset, please refer to calculateValueLong
 */ 
CompanySchema.methods.calculateValue = function(){
    if(this.ownedStock == 0){
        this.value = 0;
        return;
    }
	var totalStock = this.stocks.length;
    var ownedStock = this.ownedStock == totalStock ? 0 : this.ownedStock;
	this.value = Math.round((totalStock * this.ownedStock) / (totalStock - ownedStock));
    //console.log("V:" + this.value + " T:" + totalStock + " O:" + ownedStock);
    this.history.push(new HistoryValue(this.value));
}

/*
 * Calculates the value of the stock
 * This function should be used on when a hard reset, initial computation, etc. is needed
 * For quick & simple value calculations use calculateValue
 */
CompanySchema.methods.calculateValueLong = function(){
	var calculatedOwnedStock = 0;
	var totalStock = this.stocks.length;
    var stocks = this.stocks;
	for(var index = 0; index < stocks.length; index++){
		if(stocks[index].owner != ""){
			calculatedOwnedStock++;
		}
	}
    this.ownedStock = calculatedOwnedStock;
    if(this.ownedStock == 0){
        this.value = 0;
        return;
    }
    var totalStock = this.stocks.length;
	this.value = (totalStock * this.ownedStock) / (totalStock - this.ownedStock);
    this.history.push(new HistoryValue(this.value));
}

/*
 * Sells a stock back to the company
 * id The ID of the stock
 * player The player object (stock owner)
 * callback Callback function that accepts a boolean indicating if the transaction was a success
 */
CompanySchema.methods.sellStock = function(id, player, callback){
    var stock = this.stocks[0][id];
    if(stock == undefined){
        callback(false);
        return;
    }
    this.ownedStock--;
    stock.owner = "";
    var index = player.stocks.indexOf(stock.id);
    if (index > -1) {
        player.stocks.splice(index, 1);
    }
    callback(true);
}

/*
 * Buys a stock from the company
 * player Username of the buyer
 * callback Callback function that accepts a boolean indicating if the transaction was a success
 */
CompanySchema.methods.buyStock = function(player, callback){
    var stock = undefined;
    for(var index = 0; index < this.stocks.length; index++){
		if(this.stocks[index].owner == ""){
			stock = this.stocks[index];
            break;
		}
	}
    if(stock == undefined){
        callback(false);
        return;
    }
    this.ownedStock++;
    this.stocks[stock.id].owner = player.username;
    player.stocks.push(stock.id);
    callback(true);
}

var Company = mongoose.model('Company', CompanySchema);

//API LOGIC 

app.get('/stock/sell/:company/:id/:apiKey', function(req, res){
    var id = req.param("id");
    var companyName = req.param("company");
    var apiKey = req.param("apiKey");
    getPlayerFromKey(apiKey, function onPlayerGet(player){
        if(player == undefined){
            res.send("NOPE"); 
            return;
        }        
        sellStock(id, companyName, player, function onSell(transaction){
            res.send(transaction); 
        });
    });
    
});

app.get('/stock/buy/:company/:apiKey', function(req, res){
    var companyName = req.param("company");
    var apiKey = req.param("apiKey");
    getPlayerFromKey(apiKey, function onPlayerGet(player){
        if(player == undefined){
            res.send("NOPE"); 
            return;
        }
        buyStock(companyName, player, function onBuy(transaction){
            res.send(transaction);
        });
    });
});

function sellStock(stockId, companyName, player, callback){
    getStock(companyName, stockId, function onStockGet(stock){
        if(stock == undefined){
            callback("NOPE"); 
            return;                
        }
        getCompany(stock.company, function onCompanyGet(company){
            if(company == undefined){
                callback("NOPE"); 
                return;                
            }
            company.sellStock(id, player, function onSell(transaction){
                if(!transaction){
                    callbackd("NOPE");
                    return;
                }
                player.updateBalance(company.value);
                company.calculateValue();
                
                company.markModified('stocks');
                company.markModified('history');
                company.save(function (err) {
                    if(err){
                        console.log ('Error on save! Company');
                    }
                    player.save(function (err) {if (err) console.log ('Error on save! Player')});
                });
                callback("OKAY");
            });
        });        
    });    
}

function buyStock(companyName, player, callback){
    getCompany(companyName, function onCompanyGet(company){
        if(company == undefined){
            callback("NOPE 1");
            return;
        }
        company.buyStock(player, function onBuy(transaction){
            if(!transaction){
                callback("NOPE 2");
                return;
            }
            player.updateBalance(-company.value);
            company.calculateValue();
            company.markModified('stocks');
            company.markModified('history');
            company.save(function (err) {
                if(err){ 
                    console.log ('Error on save! Company, ' + err + ", " + new Date().toISOString()); 
                }
                player.save(function (err) {if (err) console.log ('Error on save! Player')});
            });
            callback("OKAY");
        });
    });
}

function getStock(companyName, id, callback){
    getCompany(companyName, function onCompanyGet(company){
       callback(company.stocks[0][id]); 
    });
}

function getCompany(name, callback){
	Company.find({name: name}).exec(function onCompanyFind(err, docs){
        if(err){
           throw err;
        }
        callback(docs[0]);  
    });
}    

function getPlayerFromKey(apiKey, callback){
	Player.find({apiKey: apiKey}).exec(function onPlayerFind(err, docs){
        if(err){
           throw err;
        }
        callback(docs[0]);  
    });
}

function validateKey(apiKey, callback){
    getPlayerFromKey(apiKey, function onPlayerGet(result){
       callback(result == undefined); 
    });
}



//var testPlayer = new Player({username: "person", apiKey: "herpderp", stocks: [], balance: 100});
//testPlayer.save();

//var testStock = new Stock(0, "donut shop", "");
//var testStock2 = new Stock(1, "donut shop", "");

//var stocks = [];
//for(var i = 0; i < 200; i++){
// stocks.push(new Stock(i, "donut shop", ""));
//}
//
//var testCompany = new Company({name: "donut shop", symbol: "DON", description: "hi i like donuts", stocks: stocks, value: 0, history: []});
//testCompany.calculateValueLong();
//testCompany.save();

var bi = 0;

function buyS(){
    if(bi > 50){
     console.log("done");
        return;   
    }
    getPlayerFromKey("herpderp", function(theplayer){
     buyStock('donut shop', theplayer, function onBuy(transaction){
        console.log(transaction);
        bi++;
        buyS();
     });       
    });
}

buyS();


    
// WEB/BIZ LOGIC

app.get('/', function(req, res){
  res.send('Hello World');
});