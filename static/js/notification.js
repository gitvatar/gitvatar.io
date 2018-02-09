"use strict";

var Notification = (function defineNotification(){
	var notificationBanner;
	var notificationBannerText;
	var cancelBtn;
	var closeBtn;

	return {
		onReady,
		show,
		hide,
	};


	// *************************

	var closeDelay;

	function onReady() {
		notificationBanner = document.querySelectorAll("[rel*=js-notification-banner]")[0];
		notificationBannerText = document.querySelectorAll("[rel*=js-notification-banner-text]")[0];
		cancelBtn = document.querySelectorAll("[rel*=js-notification-cancel-btn]")[0];
		closeBtn = document.querySelectorAll("[rel*=js-notification-close-btn]")[0];

		cancelBtn.addEventListener("click",hide,false);
		closeBtn.addEventListener("click",hide,false);
	}

	function show(notificationText,showOK = false,delayClose = false) {
		notificationBannerText.innerHTML = notificationText;
		notificationBanner.style.display = "block";
		closeBtn.style.display = showOK ? "inline" : "none";
		if (delayClose) {
			if (closeDelay != null) {
				clearTimeout(closeDelay);
			}
			closeDelay = setTimeout(hide,20000);
		}
		window.scrollTo(0,0);
	}

	function hide() {
		notificationBannerText.innerHTML = "";
		notificationBanner.style.display = "none";
		if (closeDelay != null) {
			clearTimeout(closeDelay);
			closeDelay = null;
		}
	}

})();


document.addEventListener("DOMContentLoaded",Notification.onReady);
