var express = require("express");
var app = express();
app.use(express.logger());

app.get('/', function(request, response) {
  response.send('Hello World!');
});

app.set('title', 'My Site');
app.get('title');
// => "My Site"

var port = process.env.PORT || 5000;
app.listen(port, function() {
	console.log("Listening on " + port);
});