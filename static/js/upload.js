"use strict";

var UploadAvatars = (function defineUploader(){
	var URL = window.URL || window.webkitURL;

	var emailInput;
	var emailValidIndicator;
	var uploadPicker;
	var uploadPickerBtn;
	var uploadPickerFilename;
	var uploadPickerResetBtn;
	var avatarPreview;
	var avatarPreviewCnv;
	var avatarPreviewCtx;
	var uploadBtn;
	var uploaderWidgetOverlay;

	var enteredEmail;
	var selectedFiles;

	return {
		onReady,
	};


	// *************************

	function onReady() {
		emailInput = document.querySelectorAll("[rel*=js-enter-email]")[0];
		emailValidIndicator = document.querySelectorAll("[rel*=js-email-valid-indicator]")[0];
		uploadPicker = document.querySelectorAll("[rel*=js-upload-picker]")[0];
		uploadPickerBtn = document.querySelectorAll("[rel*=js-upload-picker-label]")[0];
		uploadPickerFilename = document.querySelectorAll("[rel*=js-upload-picker-filename]")[0];
		avatarPreview = document.querySelectorAll("[rel*=js-avatar-preview]")[0];
		uploadPickerResetBtn = document.querySelectorAll("[rel*=js-upload-picker-reset]")[0];
		uploadBtn = document.querySelectorAll("[rel*=js-upload-btn]")[0];
		uploaderWidgetOverlay = document.querySelectorAll("[rel*=js-widget-overlay]")[0];

		avatarPreviewCnv = avatarPreview.querySelectorAll("canvas")[0];
		avatarPreviewCtx = avatarPreviewCnv.getContext("2d");

		emailInput.addEventListener("change",emailEntered,false);
		uploadPicker.addEventListener("change",uploadPicked,false);
		uploadPickerResetBtn.addEventListener("click",resetUploadPicker,false);
		uploadBtn.addEventListener("click",prepareUpload,false);
	}

	function emailEntered() {
		emailInput.value = emailInput.value.toLowerCase().replace(/^\s+/,"").replace(/\s+$/,"");
		if (
			emailInput.value.length > 0 &&
			/^[^@\s]+@[^\.@\s]+(?:\.[^\.@\s]+)*\.[^\.@\s]{2,}$/.test(emailInput.value)
		) {
			enteredEmail = emailInput.value;
			emailValidIndicator.innerHTML = "&#10004;";

			if (selectedFiles) {
				enableUpload();
				return;
			}
		}
		else {
			enteredEmail = null;
			emailValidIndicator.innerHTML = "";
		}

		disableUpload();
	}

	function formatFilenameDisplay(filename) {
		if (filename.length > 40) {
			return `${filename.substr(0,20)}<small>&nbsp;...&nbsp;</small>${filename.substr(-17)}`;
		}
		return filename;
	}

	async function uploadPicked() {
		try {
			if (uploadPicker.files.length > 0) {
				resetPreview();
				uploadPickerBtn.innerHTML = "Select Your Avatar &#10004;";
				selectedFiles = uploadPicker.files;

				uploadPickerFilename.innerHTML = formatFilenameDisplay(selectedFiles[0].name);
				uploadPickerFilename.style.display = "inline";

				let img = document.createElement("img");
				img.src = URL.createObjectURL(selectedFiles[0]);

				uploaderWidgetOverlay.style.display = "block";

				await Promise.race([
					waitForEvent(img,"load"),
					waitForEvent(img,"error")
				]);

				drawPreview(img);

				URL.revokeObjectURL(img.src);

				uploaderWidgetOverlay.style.display = "none";

				if (enteredEmail) {
					enableUpload();
					try { uploadBtn.scrollIntoView(false); } catch (err) {}
					return;
				}
			}
			else {
				resetUploadPicker();
				uploaderWidgetOverlay.style.display = "none";
			}
		}
		catch (err) {
			resetUploadPicker();
			uploaderWidgetOverlay.style.display = "none";
			console.log(err);
			Notification.show("Something went wrong picking that image. Please try another one.",false,true);
		}
	}

	function drawPreview(img) {
		var squareDim = Math.min(img.width,img.height,200);
		var scaledWidth = squareDim;
		var scaledHeight = squareDim;

		if (img.width > img.height) {
			scaledWidth = Math.floor(squareDim * (img.width / img.height));
		}
		else if (img.height > img.width) {
			scaledHeight = Math.floor(squareDim * (img.height / img.width));
		}

		var X = Math.floor((squareDim - scaledWidth) / 2);
		var Y = Math.floor((squareDim - scaledHeight) / 2);

		avatarPreviewCnv.width = avatarPreviewCnv.height = squareDim;
		avatarPreviewCnv.style.width = avatarPreviewCnv.style.height = `${squareDim}px`;
		avatarPreviewCtx.fillStyle = "#fff";
		avatarPreviewCtx.fillRect(0,0,squareDim,squareDim);
		avatarPreviewCtx.drawImage(img,X,Y,scaledWidth,scaledHeight);
		avatarPreview.style.display = "inline-block";
	}

	function prepareUpload() {
		try {
			emailEntered();

			if (enteredEmail && selectedFiles) {
				uploaderWidgetOverlay.style.display = "block";
				uploadPickerResetBtn.disabled = true;

				let hash = md5(enteredEmail);

				avatarPreviewCnv.toBlob(function onBlob(blob){
					processUpload(hash,blob);
				},"image/jpeg");

				enteredEmail = "";
				selectedFiles = null;
				return true;
			}

			Notification.show("Please enter a valid email address (you@domain.tld) and select a suitable avatar image.",true);
		}
		catch (err) {
			resetUploadPicker();
			uploaderWidgetOverlay.style.display = "none";
			console.log(err);
			Notification.show("Something went wrong uploading that image. Please try another one.",false,true);
		}
	}

	async function processUpload(hash,avatarBlob) {
		try {
			var reader = new FileReader();
			reader.readAsArrayBuffer(avatarBlob);

			await waitForEvent(reader,"loadend");

			if (reader.result.length >= 2.1E6) {
				Notification.show("Even with in-browser scaling, this image is too big to upload. Pick an image no bigger than 2MB.",true);
				return;
			}

			var response = await fetch(`${window.location.origin.toString()}/api/upload/${hash}`,{
				method: "POST",
				body: new Uint8Array(reader.result),
			});

			response = await response.json();

			if (response && response.url) {
				resetUploader();
				Notification.show(`Avatar image upload successful! Your <a href="${response.url}" target=_blank>avatar image</a> will be active soon.`,false,true);
				return true;
			}
		}
		catch (err) {
			console.log(err);
		}

		resetUploader();
		Notification.show("Something went wrong uploading that image. Please try again.",false,true);
	}

	function disableUpload() {
		uploadBtn.disabled = true;
		uploadBtn.style.display = "none";
	}

	function enableUpload() {
		uploadBtn.disabled = false;
		uploadBtn.style.display = "inline";
	}

	function resetUploadPicker() {
		selectedFiles = null;
		uploadPicker.value = "";
		uploadPickerBtn.innerHTML = "Select Your Avatar";
		uploadPickerFilename.innerHTML = "";
		uploadPickerFilename.style.display = "none";
		uploadPickerResetBtn.disabled = false;

		resetPreview();
		disableUpload();

		uploadPicker.focus();
	}

	function resetPreview() {
		avatarPreview.style.display = "none";
		// clear canvas
		avatarPreviewCnv.width = avatarPreviewCnv.height = 0;
		avatarPreviewCnv.style.width = avatarPreviewCnv.style.height = "0px";
	}

	function resetUploader() {
		enteredEmail = emailInput.value = "";
		emailValidIndicator.innerHTML = "";
		resetUploadPicker();
		uploaderWidgetOverlay.style.display = "none";
		emailInput.focus();
	}

	function waitForEvent(elem,evtName) {
		return new Promise(function c(res,rej){
			elem.addEventListener(evtName,function onEvt(arg){
				elem.removeEventListener(evtName,onEvt,false);
				if (evtName == "error") rej(arg);
				else res(arg);
			},false);
		});
	}

})();


document.addEventListener("DOMContentLoaded",UploadAvatars.onReady);
