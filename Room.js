var Sburb = (function(Sburb){





///////////////////////////////////
//Room Class
///////////////////////////////////

//constructor
Sburb.Room = function(name,width,height){
	this.name = name;
	this.width = width;
	this.height = height;
	this.sprites = [];
	this.effects = [];
	this.walkables = [];
	this.unwalkables = [];
	this.motionPaths = [];
	this.triggers = [];
	this.walkableMap = null;
}

Sburb.Room.prototype.mapCanvas = null;
Sburb.Room.prototype.mapData = null;

//add an Effect to the room
Sburb.Room.prototype.addEffect = function(effect){
	this.effects.push(effect);
}

//add a Trigger to the room
Sburb.Room.prototype.addTrigger = function(trigger){
	this.triggers.push(trigger);
}

//add a Sprite to the room
Sburb.Room.prototype.addSprite = function(sprite){
	this.sprites.push(sprite);
}

//remove a Sprite from the room
Sburb.Room.prototype.removeSprite = function(sprite){
	var i;
	for(i=0;i<this.sprites.length;i++){
		if(this.sprites[i]==sprite){
			this.sprites.splice(i,1);
			return true;
		}
	}
	return false;
}

//add a walkable to the room
Sburb.Room.prototype.addWalkable = function(path){
	this.walkables.push(path);
}

//add an unwalkable to the room
Sburb.Room.prototype.addUnwalkable = function(path){
	this.unwalkables.push(path);
}

//add a motionPath to the room
Sburb.Room.prototype.addMotionPath = function(path,xtox,xtoy,ytox,ytoy,dx,dy) {
	var motionPath = new function (){
		this.path = path;
		this.xtox = xtox; this.xtoy = xtoy;
		this.ytox = ytox; this.ytoy = ytoy;
		this.dx = dx; this.dy = dy;
	};
	this.motionPaths.push(motionPath);
}

//remove a walkable from the room
Sburb.Room.prototype.removeWalkable = function(path){
	this.walkables.splice(this.walkables.indexOf(path),1);
}

//remove an unwalkable to the room
Sburb.Room.prototype.removeUnwalkable = function(path){
	this.unwalkables.splice(this.unwalkables.indexOf(path),1);
}

//remove a motionPath from the room
Sburb.Room.prototype.removeMotionPath = function(path) {
	for(var i=0;i<this.motionPaths.length;i++){
		var mpath = this.motionPaths[i];
		if(mpath.name == path.name){
			this.motionPaths.splice(i,1);
			return;
		}
	}
}

//perform any intialization
Sburb.Room.prototype.enter = function(){
	if(this.walkableMap){
		var mapCanvas = document.getElementById("SBURBMapCanvas");
		
		var drawWidth = mapCanvas.width = this.walkableMap.width;
		var drawHeight = mapCanvas.height = this.walkableMap.height;
		var ctx = mapCanvas.getContext("2d");
		ctx.drawImage(this.walkableMap,0,0,drawWidth,drawHeight, 0,0,drawWidth,drawHeight);
		this.mapCanvas = mapCanvas;
		
		this.mapData = ctx.getImageData(0,0,drawWidth,drawHeight).data
	}
}

//perform any exit activities necessary
Sburb.Room.prototype.exit = function(){
	this.effects = [];
}

//check if the room contains the sprite
Sburb.Room.prototype.contains = function(sprite){
	for(var i=0;i<this.sprites.length;i++){
		if(this.sprites[i]==sprite){
			return true;
		}
	}
	return false;
}

//update the room one frame
Sburb.Room.prototype.update = function(){
	var i;
	for(i=0;i<this.sprites.length;i++){
		this.sprites[i].update(this);
	}
	for(i=this.effects.length-1;i>=0;i--){
		if(this.effects[i].hasPlayed()){
			this.effects.splice(i,1);
		}else{
			this.effects[i].update();
		}
	}
	for(i=this.triggers.length-1;i>=0;i--){
		if(this.triggers[i].tryToTrigger()){
			this.triggers.splice(i,1);
		}
	}
}

//draw the room
Sburb.Room.prototype.draw = function(){
	this.sortDepths();
	
	for(var i=0;i<this.sprites.length;i++){
		this.sprites[i].draw();
	}
	for(i=0;i<this.effects.length;i++){
		this.effects[i].draw(0,0);
	}
}

//sort the sprites by depth
Sburb.Room.prototype.sortDepths = function(){
	//insertion sort?!?
	var i,j;
	for(i=1,j=1;i<this.sprites.length;i++,j=i){
		var temp = this.sprites[j];
		while(j>0 && temp.isBehind(this.sprites[j-1])){
			this.sprites[j] = this.sprites[j-1]
			j--;
		}
		this.sprites[j] = temp;
	}
}

//query the room for an action based on actual collisions
Sburb.Room.prototype.queryActions = function(query,x,y){
	var validActions = [];
	for(var i=0;i<this.sprites.length;i++){
		var sprite = this.sprites[i];
		if(sprite!=query && sprite.hitsPoint(x,y)){
			validActions = validActions.concat(sprite.getActions(query));
		}
	}
	return validActions;
}

//query the room for an action based on visual collisions
Sburb.Room.prototype.queryActionsVisual = function(query,x,y){
	var validActions = [];
	for(var i=0;i<this.sprites.length;i++){
		var sprite = this.sprites[i];
		if(sprite.isVisuallyUnder(x,y)){
			validActions = validActions.concat(sprite.getActions(query));
		}
	}
	return validActions;
}

//check if the sprite is in bounds
Sburb.Room.prototype.isInBounds = function(sprite,dx,dy){
	
	var queries = sprite.getBoundaryQueries(dx,dy);
	var result = this.isInBoundsBatch(queries);
	for(var point in result){
		if(!result[point]){
			return false;
		}
	}
	return true;
}

//check if a series of points are in bounds
Sburb.Room.prototype.isInBoundsBatch = function(queries,results){
	if(typeof results != "object"){
		results = {};
		for(var queryName in queries){
			results[queryName] = false;
		}
	}
	if(this.walkableMap){
		for(var query in queries){
			var pt = queries[query];
			var data = this.mapData;
			var width = this.mapCanvas.width;
			var height = this.mapCanvas.height;
			if(pt.x<0 || pt.x>width*2 || pt.y<0 || pt.y>height*2){
				console.log("whop");
				results[query] = false;
			}else{
				var imgPt = (Math.round(pt.x/2)+Math.round(pt.y/2)*width)*4;
				results[query] = !!data[imgPt];
			}
		}
	}
	for(var i=0;i<this.walkables.length;i++){
		this.walkables[i].queryBatchPos(queries,results);
	}
	for(var i=0;i<this.unwalkables.length;i++){
		this.unwalkables[i].queryBatchNeg(queries,results);
	}
	
	return results;
}

//get the move function
Sburb.Room.prototype.getMoveFunction = function(sprite) {
	var result;
	for(i=0; i<this.motionPaths.length; i++) {
		var motionPath = this.motionPaths[i];
		var shouldMove = motionPath.path.query({x:sprite.x,y:sprite.y});
		if(shouldMove) {
			result = function(ax, ay) {
				var fx,fy;
				fx = (ax*motionPath.xtox + ay*motionPath.ytox + motionPath.dx);
				fy = (ax*motionPath.xtoy + ay*motionPath.ytoy + motionPath.dy);
				return {x:fx,y:fy};
			};
			return result;
		}
	}	
}

//check if a sprite collides with anything
Sburb.Room.prototype.collides = function(sprite,dx,dy){
	for(var i=0;i<this.sprites.length;i++){
		var theSprite = this.sprites[i];
		if(theSprite.collidable && sprite!=theSprite){
			if( sprite.collides(theSprite,dx,dy)){
				return theSprite;
			}
		}
	}
	return null;
}

//serialize the room to XML
Sburb.Room.prototype.serialize = function(output){
	output = output.concat("\n<room name='"+this.name+
	"' width='"+this.width+
	"' height='"+this.height+
	(this.walkableMap?("' walkableMap='"+this.walkableMap.name):"")+
	"' >");
	output = output.concat("\n<paths>");
	for(var i=0;i<this.walkables.length;i++){
		var walkable = this.walkables[i];
		output = output.concat("\n<walkable path='"+walkable.name+"'/>");
	}
	for(var i=0;i<this.unwalkables.length;i++){
		var unwalkable = this.unwalkables[i];
		output = output.concat("\n<unwalkable path='"+unwalkable.name+"'/>");
	}
	for(var i=0;i<this.motionPaths.length;i++){
		var motionPath = this.motionPaths[i];
		 output = output.concat("\n<motionpath path='"+motionPath.path.name+"' xtox='"+motionPath.xtox+"' xtoy='"+motionPath.xtoy+
		 "' ytox='"+motionPath.ytox+"' ytoy='"+motionPath.ytoy+"' dx='"+motionPath.dx+"' dy='"+motionPath.dy+"'/>");
	}
	output = output.concat("\n</paths>");
	output = output.concat("\n<triggers>");
	for(var i=0;i<this.triggers.length;i++){
		otuput = this.triggers[i].serialize(output);
	}
	output = output.concat("\n</triggers>");
	for(var sprite in this.sprites){
		output = this.sprites[sprite].serialize(output);
	}
	
	output = output.concat("\n</room>");
	return output;
}






///////////////////////////////////////////////
//Related Utility Functions
///////////////////////////////////////////////

//parse a room from XML
Sburb.parseRoom = function(roomNode, assetFolder, spriteFolder) {
  	var attributes = roomNode.attributes;
  	var newRoom = new Sburb.Room(attributes.getNamedItem("name").value,
  			       parseInt(attributes.getNamedItem("width").value),
  			       parseInt(attributes.getNamedItem("height").value));
  	var walkableMap = attributes.getNamedItem("walkableMap");
  	if(walkableMap){
  		newRoom.walkableMap = assetFolder[walkableMap.value];
  	}
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("sprite"), spriteFolder);
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("character"), spriteFolder);
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("fighter"), spriteFolder);
  	var paths = roomNode.getElementsByTagName("paths");
  	if(paths.length>0){
		Sburb.serialLoadRoomPaths(newRoom, paths, assetFolder);
	}
	var triggers = roomNode.getElementsByTagName("triggers")
	if(triggers.length>0){
		Sburb.serialLoadRoomTriggers(newRoom,triggers,spriteFolder);
	}
	return newRoom;
}



return Sburb;
})(Sburb || {});
