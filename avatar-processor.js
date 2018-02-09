"use strict";

var sharp = require("sharp");

var AvatarProcessor = Object.assign(module.exports,{
	normalize,
});


// *********************************

async function normalize(imageBuf) {
	var img = sharp(imageBuf);
	var metadata = await img.metadata();
	var squareDim = Math.min(metadata.width,metadata.height,200);

	imageBuf = await img
		.withoutEnlargement(true)
		.resize(squareDim,squareDim)
		.min()
		.crop()
		.toBuffer();

	return sharp({
			create: {
				width: squareDim,
				height: squareDim,
				channels: 3,
				background: { r: 255, g: 255, b: 255, alpha: 1 }
  			}
		})
		.overlayWith(imageBuf)
		.jpeg()
		.toBuffer();
}
