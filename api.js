"use strict";

var path = require("path");
var fs = require("fs");
var getStream = require("get-stream");
var md5 = require("blueimp-md5");
var LRU = require("lru-cache");

var config = require(path.join(__dirname,"config.js"));
var AvatarProcessor = require(path.join(__dirname,"avatar-processor.js"));
var GitAvatars = require(path.join(__dirname,"git-avatars.js"));
var DB = require(path.join(__dirname,"db.js"));

var API = Object.assign(module.exports,{
	handle,
});

init();


// *********************************

var avatarHashes;
var cachePruneInterval;

function init() {
	avatarHashes = LRU({
		max: 1E4,
		maxAge: 60*60*1000,
	});

	cachePruneInterval = setInterval(cleanCache,20*60*1000);
}

function cleanCache() {
	avatarHashes.prune();
}

async function handle(req,res) {
	var [,action,val] = req.url.match(/^\/api\/(hash|lookup|history|upload)\/(.+)$/);

	// no need to send CSP headers for API responses
	res.removeHeader("Content-Security-Policy");

	if (action == "hash" && req.method == "GET") {
		val = val.toLowerCase().replace(/^\s+/,"").replace(/\s+$/,"");

		// looks kinda like a valid email address?
		if (
			val.length >= 5 &&
			val.length <= 100 &&
			/^[^@\s]+@[^\.@\s]+(?:\.[^\.@\s]+)*\.[^\.@\s]{2,}$/.test(val)
		) {
			res.writeHead(200,{
				"Content-Type": "application/json",
				"Cache-Control": "public, immutable, max-age=31536000",
			});
			res.end(JSON.stringify({ hash: md5(val) }));
			return true;
		}

		return false;
	}
	else if (action == "lookup" && req.method == "GET") {
		if (checkEmailHash(val)) {
			let commitHash;

			// first check the LRU cache
			if (avatarHashes.has(val)) {
				commitHash = avatarHashes.get(val);
			}
			// otherwise pull from the database
			else {
				commitHash = DB.getCommitHash(val);
			}

			if (commitHash != null) {
				// found commit hash, but not yet in cache?
				if (!avatarHashes.has(val)) {
					avatarHashes.set(val,commitHash);
				}

				res.writeHead(200,{
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=86400",
				});
				res.end(JSON.stringify({ url: generateURL(commitHash) }));
				return true;
			}
		}

		return false;
	}
	else if (action == "history" && req.method == "GET") {
		if (checkEmailHash(val)) {
			let commitHashes = DB.getAllCommitHashes(val);

			if (commitHashes && commitHashes.length > 0) {
				res.writeHead(200,{
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=86400",
				});
				res.end(JSON.stringify({ urls: commitHashes.map(generateURL) }));
				return true;
			}
		}

		return false;
	}
	else if (action == "upload" && req.method == "POST") {
		if (checkEmailHash(val)) {
			try {
				// receive image from request (max: 2MB)
				let avatarBuf = await getStream.buffer(req,{ maxBuffer: 2.1E6 });

				// normalize image
				avatarBuf = await AvatarProcessor.normalize(avatarBuf);

				// commit image to git repo
				let commitHash = await GitAvatars.saveAvatar(avatarBuf);

				// save to DB
				if (DB.storeHashes(val,commitHash)) {
					// only for local dev, save file to GHUC mirror
					if (process.env.LOCALHOST) {
						localGHUCMirror(commitHash,avatarBuf);
					}

					// save to cache
					avatarHashes.set(val,commitHash);

					// fake delay
					await delay(1500);

					res.writeHead(200,{
						"Content-Type": "application/json",
						"Cache-Control": "no-cache, no-store, must-revalidate"
					});
					res.end(JSON.stringify({ url: generateURL(commitHash) }));
					return true;
				}
			}
			catch (err) {
				console.error(err);
			}
		}

		return false;
	}
}

function generateURL(commitHash) {
	return `${config.HTTPS.AVATAR_IMAGE_CDN}/gitvatar/a/${commitHash}/images/a.jpg`;
}

function checkEmailHash(val) {
	return (
		typeof val == "string" &&
		/^[0-9a-f]{32}$/.test(val)
	);
}

function delay(ms) {
	return new Promise(function c(res){
		setTimeout(res,ms);
	});
}

function localGHUCMirror(commitHash,imageBuf) {
	var hashDir = path.join(config.LOCAL_GHUC_DIR,commitHash);
	fs.mkdirSync(hashDir);
	fs.mkdirSync(path.join(hashDir,"images"));
	fs.writeFileSync(path.join(hashDir,"images","a.jpg"),imageBuf);
}
