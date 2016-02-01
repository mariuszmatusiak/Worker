var express = require("express");

var sendFile = function(path) {
	return function(request, callback){
		callback(null, null, path); 
	}
}


var service = function(requestProcessors){
	var app = express();
	app.use(express.json());
	app.use(express.urlencoded());
	
	var handlers = {};	
	for(var i = 0; i < requestProcessors.length; i ++){	
		var path = requestProcessors[i].path;		
		var action = requestProcessors[i].action;
		if(handlers[path]) {
			throw new Error(path + " - duplicated path");
		}
		action = (typeof(action) == "function" ? action : sendFile(action));
		handlers[path] = action;
	}

	Object.keys(handlers).forEach(function(key){
		app.all(key, function(request, response){
			console.log("request processing started");
			handlers[key](request, function(err, result, file){
				if(file){
					if(file.template){
						renderView(response, file.template, file.params);
					} else {
					response.sendfile(file);
					}
				}
				else if(err) {
						response.send("an error occured " + err);					
				}else {
					var reqResponse = result ? result : "";
					if(reqResponse.template){
						renderView(response, reqResponse.template, reqResponse.params);
					}else {
						response.send(reqResponse);
					}
				}
				console.log("request processing finished");					
			});
		});
	});

	return function(port){
		
		app.listen(port);		
	}
}

var renderView = function(response, template, params){
	response.render(template, params);
}
exports.http = service;
