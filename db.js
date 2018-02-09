"use strict";

var fs = require("fs");
var path = require("path");
var sqlite3 = require("better-sqlite3");

var config = require(path.join(__dirname,"config.js"));

var DB = Object.assign(module.exports,{
	getCommitHash,
	getAllCommitHashes,
	storeHashes,
});

init();


// *********************************

var avatarsDB;

function init() {
	avatarsDB = new sqlite3(config.DB.PATH);
	var initSQL = fs.readFileSync(path.join(__dirname,"avatars.sql"),"utf-8");
	avatarsDB.exec(initSQL);
}

function getCommitHash(emailHash) {
	var result = avatarsDB.prepare(`
			SELECT
				avatar.hash
			FROM
				EmailHashes AS "email"
				JOIN AvatarHashes AS "avatar" ON (avatar.emailID = email.id)
			WHERE
				email.hash = ?
				AND email.disabled = 0
				AND avatar.disabled = 0
			ORDER BY
				avatar.id DESC
			LIMIT 1
		`)
		.get(emailHash);

	return result ? result.hash : undefined;
}

function getAllCommitHashes(emailHash) {
	var result = avatarsDB.prepare(`
			SELECT
				avatar.hash
			FROM
				EmailHashes AS "email"
				JOIN AvatarHashes AS "avatar" ON (avatar.emailID = email.id)
			WHERE
				email.hash = ?
				AND email.disabled = 0
				AND avatar.disabled = 0
			ORDER BY
				avatar.id DESC
			LIMIT
				25
		`)
		.all(emailHash);

	return result
		.map(function getHash(row){
			return row.hash;
		});
}

function storeHashes(emailHash,commitHash) {
	var emailID = getOrInsertEmailHashID(emailHash);

	if (emailID != null) {
		let result = avatarsDB.prepare(`
				INSERT INTO
					AvatarHashes
					(emailID, hash)
				VALUES
					(?, ?)
			`)
			.run(emailID,commitHash);

		if (
			result != null &&
			result.changes > 0
		) {
			return true;
		}
	}

	return false;
}

function getOrInsertEmailHashID(emailHash) {
	var result = avatarsDB.prepare(`
			SELECT
				id, disabled
			FROM
				EmailHashes
			WHERE
				hash = ?
		`)
		.get(emailHash);

	if (result != null) {
		if (result.disabled === 0) {
			return result.id;
		}
	}
	else {
		result = avatarsDB.prepare(`
			INSERT INTO
				EmailHashes
			(hash)
			VALUES
				(?)
			`)
			.run(emailHash);

		if (
			result != null &&
			result.changes > 0
		) {
			return result.lastInsertROWID;
		}
	}
}
