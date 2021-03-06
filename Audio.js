var Sburb = (function(Sburb){

Sburb.globalVolume = 1;




///////////////////////////////////////
//Sound Class
///////////////////////////////////////

//Constructor
Sburb.Sound = function(asset){
	this.asset = asset;
}

//play this sound
Sburb.Sound.prototype.play = function() {
	this.fixVolume();
	this.asset.play();	
}

//pause this sound
Sburb.Sound.prototype.pause = function() {
	this.asset.pause();
}

//stop this sound
Sburb.Sound.prototype.stop = function() {
	this.pause();
	this.asset.currentTime = 0;
}

//has the sound stopped
Sburb.Sound.prototype.ended = function() {
	return this.asset.ended;
}

//ensure the sound is playing at the global volume
Sburb.Sound.prototype.fixVolume = function(){
	this.asset.volume = Sburb.globalVolume;
	this.asset.pause();
	this.asset.play();
}





/////////////////////////////////////
//BGM Class (inherits Sound)
/////////////////////////////////////

//constructor
Sburb.BGM = function(asset, startLoop, priority) {
    Sburb.Sound.call(this,asset);
    this.startLoop;
    this.endLoop;
    
    this.setLoopPoints(startLoop?startLoop:0); 
}

Sburb.BGM.prototype = new Sburb.Sound();

//set the points in the sound to loop
Sburb.BGM.prototype.setLoopPoints = function(start, end) {
	tmpAsset = this.asset
	tmpAsset.addEventListener('ended', function() {
		tmpAsset.currentTime = start;
		tmpAsset.play();
	},false);
	this.startLoop = start;
	this.endLoop = end;
	// do we need to have an end point? does that even make sense
}

//loop the sound
Sburb.BGM.prototype.loop = function() {
		this.asset.currentTime = this.startLoop;
		this.asset.play();
}



return Sburb;
})(Sburb || {});
