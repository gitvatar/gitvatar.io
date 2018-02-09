"use strict";

var ViewAvatar = (function defineView(){
	var emailInput;
	var viewBtn;
	var displayAvatarWidget;
	var avatarURL;
	var avatarImageContainer;
	var displayAvatarWidgetOverlay;

	return {
		onReady,
	};


	// *************************

	function onReady() {
		emailInput = document.querySelectorAll("[rel*=js-enter-email]")[0];
		viewBtn = document.querySelectorAll("[rel*=js-view-btn]")[0];
		displayAvatarWidget = document.querySelectorAll("[rel*=js-display-avatar-widget]")[0];
		avatarURL = document.querySelectorAll("[rel*=js-display-avatar-url]")[0];
		avatarImageContainer = document.querySelectorAll("[rel*=js-display-avatar-img]")[0];
		displayAvatarWidgetOverlay = document.querySelectorAll("[rel*=js-widget-overlay]")[0];

		viewBtn.addEventListener("click",getAvatar,false);
		emailInput.addEventListener("change",emailEntered,false);
	}

	function emailEntered() {
		emailInput.value = emailInput.value.toLowerCase().replace(/^\s+/,"").replace(/\s+$/,"");
	}

	async function getAvatar() {
		resetAvatarDisplayWidget();

		emailEntered();
		var email = emailInput.value;

		if (!(
			typeof email == "string" &&
			email.length >= 5 &&
			email.length <= 100 &&
			/^[^@\s]+@[^\.@\s]+(?:\.[^\.@\s]+)*\.[^\.@\s]{2,}$/.test(email)
		)) {
			Notification.show("Please enter a valid email address. (you@domain.tld)",true);
			return false;
		}

		emailInput.value = "";

		displayAvatarWidget.style.display = "block";
		displayAvatarWidgetOverlay.style.display = "block";
		avatarURL.innerHTML = "...";

		var hash = md5(email);

		try {
			var response = await fetch(`${window.location.origin.toString()}/api/lookup/${hash}`,{
				method: "GET",
			});

			response = await response.json();

			if (response && response.url) {
				avatarURL.innerHTML = response.url;

				let img = document.createElement("img");
				img.setAttribute("alt",email);
				img.setAttribute("title",email);
				img.src = response.url;
				img.addEventListener("load",function onload(){
					img.removeEventListener("load",onload,false);
					displayAvatarWidgetOverlay.style.display = "none";
					if (Number(img.width) > 0) {
						avatarImageContainer.style.display = "inline-block";
						try { avatarImageContainer.scrollIntoView(false); } catch (err) {}
					}
					else {
						Notification.show("Avatar image failed to load. Please try again in a few minutes.",false,true);
					}
				},false);
				img.addEventListener("error",function onerror(){
					img.removeEventListener("error",onerror,false);
					displayAvatarWidgetOverlay.style.display = "none";
					Notification.show("Avatar image failed to load. Please try again in a few minutes.",false,true);
				},false);

				avatarImageContainer.appendChild(img);
			}
			else {
				resetAvatarDisplayWidget();
				throw response;
			}
		}
		catch (err) {
			resetAvatarDisplayWidget();
			emailInput.value = email;
			emailInput.select();
			emailInput.focus();
			console.log(err);
			Notification.show("Avatar image not found. Check the email address.",false,true);
		}
	}

	function resetAvatarDisplayWidget() {
		avatarURL.innerHTML = "";
		avatarImageContainer.innerHTML = "";
		avatarImageContainer.style.display = "none";
		displayAvatarWidget.style.display = "none";
	}

})();


document.addEventListener("DOMContentLoaded",ViewAvatar.onReady);
