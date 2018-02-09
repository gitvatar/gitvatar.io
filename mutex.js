"use strict";

var Mutex = Object.assign(module.exports,{
	create,
});


// *********************************

function create() {
	var locked = false;
	var p = null;

	return {
		lock,
		isLocked,
	};


	// *********************************

	function lock() {
		if (!isLocked()) {
			locked = true;
			let resolve;
			p = new Promise(function c(res){
				resolve = res;
			});
			return function unlock(){
				locked = false;
				if (resolve) {
					resolve();
					resolve = null;
				}
			};
		}
		else {
			p = p.then(lock);
			return p;
		}
	}

	function isLocked() {
		return locked;
	}
}
