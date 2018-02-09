"use strict";

var path = require("path");
var fs = require("fs");
var https = require("https");
var staticAlias = require("node-static-alias");

var config = require(path.join(__dirname,"config.js"));
var API = require(path.join(__dirname,"api.js"));


var fileServer = new staticAlias.Server(config.STATIC_DIR,{
	cache: config.HTTPS.STATIC_FILE_CACHE_LENGTH,
	serverInfo: config.HTTPS.SERVER_NAME,
	gzip: /^\/text/,
	alias: [
		{
			match: /^\/(?:index\/?)?(?:[?#].*$)?$/,
			serve: "index.html",
			force: true,
		},
		{
			match: /^\/(?:(?:(?:css|js|images)\/.+)|(?:robots\.txt|humans\.txt|favicon\.ico))$/,
			serve: "<% absPath %>",
			force: true,
		},
		{
			match: /^\/(?:[\w\d]+)(?:[\/?#].*$)?$/,
			serve: function onMatch(params) {
				return `${params.basename}.html`;
			},
		},
		{
			match: /[^]/,
			serve: "404.html",
		},
	],
});

var httpsserv = https.createServer({
	key: fs.readFileSync(config.HTTPS.KEY_PATH),
	cert: fs.readFileSync(config.HTTPS.CERT_PATH),
},handleRequest);

httpsserv.listen(config.HTTPS.SERVER_PORT,config.HTTPS.SERVER_ADDR);

console.log(`Listening on ${config.HTTPS.SERVER_ADDR}:${config.HTTPS.SERVER_PORT}...`);



// **************************

async function handleRequest(req,res) {
	// handle hostname/protocol redirects?
	if (
		config.HTTPS.ENFORCE_REDIRECTS &&
		(
			req.headers["host"] == "gitvatar.com" ||
			req.headers["host"] == "www.gitvatar.com" ||
			req.headers["host"] == "www.gitvatar.io" ||
			req.headers["x-forwarded-proto"] !== "https"
		)
	) {
		res.writeHead(301,{ Location: config.HTTPS.SITE_URL });
		res.end();
		return;
	}

	res.setHeader("Server",config.HTTPS.SERVER_NAME);

	// From: https://developer.mozilla.org/en-US/docs/Security/CSP/Introducing_Content_Security_Policy
	res.setHeader("Content-Security-Policy",config.HTTPS.CSP_HEADER);

	// From: https://developer.mozilla.org/en-US/docs/Security/HTTP_Strict_Transport_Security
	res.setHeader("Strict-Transport-Security",config.HTTPS.HSTS_HEADER);

	// CORS preflight request for API?
	if (
		req.method == "OPTIONS" &&
		/^\/api\/./.test(req.url) &&
		req.headers["access-control-request-method"] in config.HTTPS.API_CORS_HEADERS
	) {
		res.writeHead(200,config.HTTPS.API_CORS_HEADERS[req.headers["access-control-request-method"]]);
		res.end();
	}
	// CORS preflight request for rest of the site?
	else if (
		req.method == "OPTIONS" &&
		req.headers["access-control-request-method"] in config.HTTPS.CORS_HEADERS
	) {
		res.writeHead(200,config.HTTPS.CORS_HEADERS[req.headers["access-control-request-method"]]);
		res.end();
	}
	// favicon request?
	else if (req.method == "GET" && req.url == "/favicon.ico") {
		// check if favicon exists?
		try {
			fs.statSync(path.join(config.STATIC_DIR,"favicon.ico"));
		}
		// if we get here, favicon is missing
		catch (err) {
			// cacheable empty favicon.ico response
			res.writeHead(204,{
				"Content-Type": "image/x-icon",
				"Cache-Control": "public, max-age: 604800"
			});
			res.end();
			return;
		}

		// otherwise, hand request off to the static file server
		fileServer.serve(req,res);
	}
	// API call?
	else if (
		["GET","POST"].includes(req.method) &&
		/^\/api\/./.test(req.url)
	) {
		if (!(await API.handle(req,res))) {
			res.writeHead(403,config.HTTPS.API_CORS_HEADERS.GET);
			res.end();
		}
	}
	else if (["GET","HEAD"].includes(req.method)) {
		// hand request off to the static file server
		fileServer.serve(req,res);
	}
	// otherwise, bail because we won't handle this kind of request!
	else {
		res.writeHead(403,config.HTTPS.CORS_HEADERS.GET);
		res.end();
	}
}
