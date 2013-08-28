var express = require('express');
var app = express();

app.use('/sprite-cow-navcontroller/static', express.static(__dirname + '/www/static'));

app.get('/sprite-cow-navcontroller/', function(req, res){
  res.sendfile('www/index.html');
});

app.listen(3000);

exports = app;