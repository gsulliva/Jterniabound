if(typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, ''); 
  }
}

var Sburb = (function(Sburb){
//650x450 screen
Sburb.Keys = {backspace:8,tab:9,enter:13,shift:16,ctrl:17,alt:18,escape:27,space:32,left:37,up:38,right:39,down:40,w:87,a:65,s:83,d:68};

Sburb.Stage = null; //the canvas, we're gonna load it up with a bunch of flash-like game data like fps and scale factors
Sburb.stage = null; //its context
Sburb.pressed = null; //the pressed keys
Sburb.assetManager = null; //the asset loader
Sburb.assets = null; //all images, sounds, paths
Sburb.sprites = null; //all sprites that were Serial loaded
Sburb.effects = null; //all effects that were Serial loaded
Sburb.rooms = null; //all rooms
Sburb.char = null; //the player
Sburb.curRoom = null;
Sburb.destRoom = null; //current room, the room we are transitioning to, if it exists.
Sburb.destX = null;
Sburb.destY = null; //the desired location in the room we are transitioning to, if it exists.
Sburb.focus = null; //the focus of the camera (a sprite), usually just the char
Sburb.chooser = null; //the option chooser
Sburb.curAction = null; //the current action being performed
Sburb.bgm = null; //the current background music
Sburb.hud = null; //the hud; help and sound buttons
Sburb.Mouse = {down:false,x:0,y:0}; //current recorded properties of the mouse
Sburb.waitFor = null;
Sburb.engineMode = "wander";

Sburb.updateLoop = null; //the main updateLoop, used to interrupt updating
Sburb.initFinished = null; //only used when _hardcode_load is true
Sburb._hardcode_load = null; //set to 1 when we don't want to load from XML: see initialize()

Sburb.initialize = function(div,levelName,includeDevTools){
	var deploy = ' \
	<div style="padding-left: 0;\
		padding-right: 0;\
		margin-left: auto;\
		margin-right: auto;\
		display: block;\
		width:650px;\
		height:450px;"> \
		<div id="gameDiv" >\
			<canvas id="Stage" width="650" height="450" tabindex="0" \
						onmousedown = "Sburb.onMouseDown(event,this)"\
						onmousemove = "Sburb.onMouseMove(event,this)"\
						onmouseup = "Sburb.onMouseUp(event,this)"\
						>\
			</canvas>\
		</div>\
		<div id="movieBin"></div>\
		</br>';
	if(includeDevTools){
		deploy+='\
		<div> \
			<button id="saveState" onclick="Sburb.serialize(Sburb.assets, Sburb.effects, Sburb.rooms, Sburb.sprites, Sburb.hud, Sburb.dialoger, Sburb.curRoom, Sburb.char)">save state</button>\
			<button id="loadState" onclick="Sburb.loadSerial(document.getElementById(\'serialText\').value)">load state</button>\
			<input type="file" name="level" id="levelFile" />\
			<button id="loadLevelFile" onclick="Sburb.loadLevelFile(document.getElementById(\'levelFile\'))">load level</button>\
			<button id="strifeTest" onclick="Sburb.loadSerialFromXML(\'levels/strifeTest.xml\')">strife test</button>\
			<button id="wanderTest" onclick="Sburb.loadSerialFromXML(\'levels/wanderTest.xml\')">wander test</button>\
			</br>\
			<textarea id="serialText" style="display:inline; width:650; height:100;"></textarea><br/>\
		</div>';
	}
	deploy+='</div>';
	document.getElementById(div).innerHTML = deploy;
	var gameDiv = document.getElementById("gameDiv");
	gameDiv.onkeydown = _onkeydown;
	gameDiv.onkeyup = _onkeyup;
	Sburb.Stage = document.getElementById("Stage");	
	Sburb.Stage.scaleX = Sburb.Stage.scaleY = 3;
	Sburb.Stage.x = Sburb.Stage.y = 0;
	Sburb.Stage.fps = 30;
	Sburb.Stage.fade = 0;
	Sburb.Stage.fadeRate = 0.1;
	
	Sburb.stage = Sburb.Stage.getContext("2d");
	
	Sburb.chooser = new Sburb.Chooser();
	Sburb.dialoger = new Sburb.Dialoger();
    Sburb.assetManager = new Sburb.AssetManager();
	Sburb.assets = Sburb.assetManager.assets; // shortcut for raw asset access
	Sburb.rooms = {};
	Sburb.sprites = {};
	Sburb.effects = {};
	Sburb.hud = {};
	Sburb.pressed = [];
	
    Sburb.loadSerialFromXML(levelName); // comment out this line and
    //loadAssets();                        // uncomment these two lines, to do a standard hardcode load
    //_hardcode_load = 1;
}

function update(){
	//update stuff
	handleInputs();
	handleHud();
	
	Sburb.curRoom.update();
	
	focusCamera();
	handleRoomChange();
	Sburb.chooser.update();
	Sburb.dialoger.update();
	chainAction();
	updateWait();
	
	//must be last
    
	Sburb.updateLoop=setTimeout(update,1000/Sburb.Stage.fps);
	draw();
}

function draw(){
	//stage.clearRect(0,0,Stage.width,Stage.height);
	
	Sburb.stage.save();
	Sburb.Stage.offset = true;
	Sburb.stage.translate(-Stage.x,-Stage.y);
	
	Sburb.curRoom.draw();
	Sburb.chooser.draw();
	
	Sburb.stage.restore();
	Sburb.Stage.offset = false;
	Sburb.dialoger.draw();
	
	if(Sburb.Stage.fade>0.1){
		Sburb.stage.fillStyle = "rgba(0,0,0,"+Sburb.Stage.fade+")";
		Sburb.stage.fillRect(0,0,Sburb.Stage.width,Sburb.Stage.height);
	}
	
	drawHud();
}

var _onkeydown = function(e){
	if(Sburb.chooser.choosing){
		if(e.keyCode == Sburb.Keys.down || e.keyCode==Sburb.Keys.s){
			Sburb.chooser.nextChoice();
		}
		if(e.keyCode == Sburb.Keys.up || e.keyCode==Sburb.Keys.w){
			Sburb.chooser.prevChoice();
		}
		if(e.keyCode == Sburb.Keys.space && !Sburb.pressed[Sburb.Keys.space]){
			Sburb.performAction(Sburb.chooser.choices[Sburb.chooser.choice]);
			Sburb.chooser.choosing = false;
		}
	}else if(Sburb.dialoger.talking){
		if(e.keyCode == Sburb.Keys.space && !Sburb.pressed[Sburb.Keys.space]){
			Sburb.dialoger.nudge();
		}
	}else if(hasControl()){
		if(e.keyCode == Sburb.Keys.space && !Sburb.pressed[Sburb.Keys.space] && Sburb.engineMode=="wander"){
			Sburb.chooser.choices = [];
			var queries = Sburb.char.getActionQueries();
			for(var i=0;i<queries.length;i++){
				Sburb.chooser.choices = Sburb.curRoom.queryActions(Sburb.char,queries[i].x,queries[i].y);
				if(Sburb.chooser.choices.length>0){
					break;
				}
			}
			if(Sburb.chooser.choices.length>0){
				Sburb.chooser.choices.push(new Sburb.Action("cancel","cancel","cancel"));
				beginChoosing();
			}
		}
	}
	Sburb.pressed[e.keyCode] = true;
    // return true if we want to pass keys along to the browser, i.e. Ctrl-N for a new window
    if(e.altKey || e.ctrlKey || e.metaKey) {
		// don't muck with system stuff
		return true;
    }
    return false;
}

var _onkeyup = function(e){
	Sburb.pressed[e.keyCode] = false;
}

Sburb.onMouseMove = function(e,canvas){
	var point = relMouseCoords(e,canvas);
	Sburb.Mouse.x = point.x;
	Sburb.Mouse.y = point.y;
}

Sburb.onMouseDown = function(e,canvas){
	if(Sburb.engineMode=="strife" && hasControl()){
		Sburb.chooser.choices = Sburb.curRoom.queryActionsVisual(Sburb.char,Sburb.Stage.x+Sburb.Mouse.x,Sburb.Stage.y+Sburb.Mouse.y);
		if(Sburb.chooser.choices.length>0){
			Sburb.chooser.choices.push(new Sburb.Action("cancel","cancel","cancel"));
			beginChoosing();
		}
	}
	Sburb.Mouse.down = true;
	
}

Sburb.onMouseUp = function(e,canvas){
	Sburb.Mouse.down = false;
	Sburb.dialoger.nudge();
}

function relMouseCoords(event,canvas){
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = canvas;

    do{
        totalOffsetX += currentElement.offsetLeft;
        totalOffsetY += currentElement.offsetTop;
    }
    while(currentElement = currentElement.offsetParent)
    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;
    return {x:canvasX,y:canvasY};
}

Sburb.drawLoader = function(){
	Sburb.stage.fillStyle = "rgb(240,240,240)";
	Sburb.stage.fillRect(0,0,Sburb.Stage.width,Sburb.Stage.height);
	Sburb.stage.fillStyle = "rgb(200,0,0)"
	Sburb.stage.font="30px Arial";
    Sburb.stage.fillText("Loading Assets: "+Sburb.assetManager.totalLoaded+"/"+Sburb.assetManager.totalAssets,100,200);
}

function handleInputs(){
	if(hasControl()){
		Sburb.char.handleInputs(Sburb.pressed);
	}else{
		Sburb.char.moveNone();
	}
}

function handleHud(){
	for(var content in Sburb.hud){
		var obj = Sburb.hud[content];
		if(obj.updateMouse){
			obj.updateMouse(Sburb.Mouse.x,Sburb.Mouse.y,Sburb.Mouse.down);
			obj.update();
			if(obj.clicked && obj.action){
				Sburb.performAction(obj.action);
			}
		}
	}
}

function drawHud(){
	for(var content in Sburb.hud){
		Sburb.hud[content].draw();
	}
}

function hasControl(){
	return !Sburb.dialoger.talking && !Sburb.chooser.choosing && !Sburb.destRoom && !Sburb.waitFor;
}

function focusCamera(){
	//need to divide these by scaleX and scaleY if repurposed
	Sburb.Stage.x = Math.max(0,Math.min(Sburb.focus.x-Sburb.Stage.width/2,Sburb.curRoom.width-Sburb.Stage.width));
	Sburb.Stage.y = Math.max(0,Math.min(Sburb.focus.y-Sburb.Stage.height/2,Sburb.curRoom.height-Sburb.Stage.height));
	Sburb.Stage.x = Math.round(Sburb.Stage.x/3)*3;
	Sburb.Stage.y = Math.round(Sburb.Stage.y/3)*3;
}

function handleRoomChange(){
	if(Sburb.destRoom){
		if(Sburb.Stage.fade<1){
			Sburb.Stage.fade=Math.min(1,Sburb.Stage.fade+Sburb.Stage.fadeRate);
		}else {
			Sburb.char.x = Sburb.destX;
			Sburb.char.y = Sburb.destY;
			Sburb.moveSprite(Sburb.char,Sburb.curRoom,Sburb.destRoom);
			Sburb.curRoom.exit();
			Sburb.curRoom = Sburb.destRoom;
			Sburb.destRoom = null;
		}
	}else if(Sburb.Stage.fade>0.01){
		Sburb.Stage.fade=Math.max(0.01,Sburb.Stage.fade-Sburb.Stage.fadeRate);
		//apparently alpha 0 is buggy?
	}
}

function beginChoosing(){
	Sburb.char.idle();
	Sburb.chooser.beginChoosing(Sburb.char.x,Sburb.char.y);
}

function chainAction(){
	if(Sburb.curAction){
		if(Sburb.curAction.times<=0){
			if(Sburb.curAction.followUp){
				if(hasControl() || Sburb.curAction.followUp.noWait){
					Sburb.performAction(Sburb.curAction.followUp);
				}
			}else{
				Sburb.curAction = null;
			}
		}else if(hasControl() || Sburb.curAction.noWait){
			Sburb.performAction(Sburb.curAction);
		}
	}
}    

function updateWait(){
	if(Sburb.waitFor){
		if(Sburb.waitFor.checkCompletion()){
			Sburb.waitFor = null;
		}
	}
}

Sburb.performAction = function(action){
	if(action.silent){
		Sburb.performActionSilent(action);
		return;
	}
	if(((Sburb.curAction && Sburb.curAction.followUp!=action) || !hasControl()) && action.soft){
		return;
	}
	
	var looped = false;
	Sburb.curAction = action.clone();
	do{
		if(looped){
			Sburb.curAction = Sburb.curAction.followUp.clone();
		}
   	Sburb.performActionSilent(Sburb.curAction);
   	looped = true;
   }while(Sburb.curAction.times<=0 && Sburb.curAction.followUp && Sburb.curAction.followUp.noDelay);
}

Sburb.performActionSilent = function(action){
	action.times--;
	Sburb.commands[action.command.trim()](action.info.trim());
}



Sburb.changeRoom = function(newRoom,newX,newY){
	Sburb.destRoom = newRoom;
	Sburb.destX = newX;
	Sburb.destY = newY;
}



Sburb.moveSprite = function(sprite,oldRoom,newRoom){
	oldRoom.removeSprite(sprite);
	newRoom.addSprite(sprite);
}



Sburb.setCurRoomOf = function(sprite){
	if(!Sburb.curRoom.contains(sprite)){
		for(var room in Sburb.rooms){
			if(Sburb.rooms[room].contains(sprite)){
				Sburb.changeRoom(Sburb.rooms[room],Sburb.char.x,Sburb.char.y);
				return;
			}
		}
	}
}

Sburb.changeBGM = function(newSong) {
    if(newSong){
		if(Sburb.bgm) {
			if (Sburb.bgm == newSong) {
				// maybe check for some kind of restart value
				return;
			}
			Sburb.bgm.stop();
		}
		Sburb.bgm = newSong;
		Sburb.bgm.stop();
		Sburb.bgm.play();
    }
}

Sburb.playEffect = function(effect,x,y){
	Sburb.curRoom.addEffect(effect.clone(x,y));
}

Sburb.playSound = function(sound){
	sound.stop();
	sound.play();
}

Sburb.playMovie = function(movie){
	var name = movie.name;
	document.getElementById(name).style.display = "block";
	document.getElementById("gameDiv").style.display = "none";
	Sburb.waitFor = new Sburb.Trigger("movie,"+name+",1");
}




Sburb.update = update;

return Sburb;
})(Sburb || {});

    
var Sburb = (function(Sburb){




//////////////////////////////////////////
//Sprite Class
//////////////////////////////////////////

function Sprite(name,x,y,width,height,dx,dy,depthing,collidable){
	this.x = x;
	this.y = y;
	this.dx = typeof dx == "number" ? dx : 0;
	this.dy = typeof dy == "number" ? dy : 0;
	this.width = width;
	this.height = height;
	this.depthing = typeof depthing == "number" ? depthing : this.BG_DEPTHING; //bg, fg, or mg
	this.collidable = typeof collidable == "boolean" ? collidable : false;
	this.animations = {};
	this.animation = null;
	this.state = null;
	this.lastTime = 0;
	this.actions = [];
	this.name = name;
	
}

Sprite.prototype.BG_DEPTHING = 0;
Sprite.prototype.MG_DEPTHING = 1;
Sprite.prototype.FG_DEPTHING = 2;

Sprite.prototype.addAnimation = function(anim){
	this.animations[anim.name] = anim;
}

Sprite.prototype.startAnimation = function(name){
	if(this.state!=name){
		this.animation = this.animations[name];
		this.animation.reset();
		this.state = name;
	}
}

Sprite.prototype.update = function(curRoom){
	if(this.animation.hasPlayed() && this.animation.followUp){
		this.startAnimation(this.animation.followUp);
	}else{
		this.animation.update();
	}
}
Sprite.prototype.staticImg = function() {
	return this.animation.staticImg();
}

Sprite.prototype.draw = function(){
	if(this.animation!=null){
		this.animation.draw(this.x,this.y);
	}
}


Sprite.prototype.isBehind = function(other){
	if(this.depthing == other.depthing){
		return this.y+this.dy<other.y+other.dy;
	}else{
		return this.depthing<other.depthing;
	}
}

Sprite.prototype.collides = function(other,dx,dy){
	var x = this.x+(dx?dx:0);
	var y = this.y+(dy?dy:0);
	if(other.collidable){
		if( (x-this.width/2<other.x+other.width/2) &&
			 (x+this.width/2>other.x-other.width/2) &&
			 (y-this.height/2<other.y+other.height/2) &&
			 (y+this.height/2>other.y-other.height/2) ) {
			 return true;
		}
	}
	return false;
}
Sprite.prototype.hitsPoint = function(x,y){
	if( (this.x-this.width/2 <=x) &&
		(this.x+this.width/2 >=x) &&
		(this.y-this.height/2 <=y) &&
		(this.y+this.height/2 >=y) ) {
		return true;
	}
    return false;
}

Sprite.prototype.isVisuallyUnder = function(x,y){
	return this.animation.isVisuallyUnder(x-this.x,y-this.y);
}

Sprite.prototype.addAction = function(action){
	this.actions.push(action);
}

Sprite.prototype.removeAction = function(name){
	for(var i=0;i<this.actions.length;i++){
		if(this.actions[i].name==name){
			this.actions.splice(i,1);
			return;
		}
	}
}

Sprite.prototype.getActions = function(sprite){
	var validActions = [];
	for(var i=0;i<this.actions.length;i++){
		if(!this.actions[i].sprite || this.actions[i].sprite==sprite){
			validActions.push(this.actions[i]);
		}
	}
	return validActions;
}

Sprite.prototype.getBoundaryQueries = function(dx,dy){
	var spriteX = this.x+(dx?dx:0);
	var spriteY = this.y+(dy?dy:0);
	var w = this.width/2;
	var h = this.height/2;
	return {upRight:{x:spriteX+w,y:spriteY-h},
				 upLeft:{x:spriteX-w,y:spriteY-h},
				 downLeft:{x:spriteX-w,y:spriteY+h},
				 downRight:{x:spriteX+w,y:spriteY+h},
				 downMid:{x:spriteX,y:spriteY+h},
				 upMid:{x:spriteX,y:spriteY-h}};
}

Sprite.prototype.serialize = function(output){
	var animationCount = 0;
	for(anim in this.animations){
			animationCount++;
	}
	
	output = output.concat("\n<Sprite "+
		Sburb.serializeAttributes(this,"name","x","y","dx","dy","width","height","depthing","collidable")+
		(animationCount>1?"state='"+this.state+"' ":"")+
		">");

	for(var anim in this.animations){
		output = this.animations[anim].serialize(output);
	}
	for(var action in this.actions){
		output = this.actions[action].serialize(output);
	}
	output = output.concat("\n</Sprite>");
	return output;
}






///////////////////////////////////////////
//Related Utility Functions
///////////////////////////////////////////

Sburb.parseSprite = function(spriteNode, assetFolder) {
	var attributes = spriteNode.attributes;
	
	var newName = null;
	var newX = 0;
	var newY = 0;
	var newWidth = 0;
	var newHeight = 0;
	var newDx = 0;
	var newDy = 0;
	var newDepthing = 0;
	var newCollidable = false;
	var newState = null;
	var newAnimations = {};

	var temp;
	newName = (temp=attributes.getNamedItem("name"))?temp.value:newName;
	newX = (temp=attributes.getNamedItem("x"))?parseInt(temp.value):newX;
	newY = (temp=attributes.getNamedItem("y"))?parseInt(temp.value):newY;
	newWidth = (temp=attributes.getNamedItem("width"))?parseInt(temp.value):newWidth;
	newHeight = (temp=attributes.getNamedItem("height"))?parseInt(temp.value):newHeight;
	newDx = (temp=attributes.getNamedItem("dx"))?parseInt(temp.value):newDx;
	newDy = (temp=attributes.getNamedItem("dy"))?parseInt(temp.value):newDy;
	newDepthing = (temp=attributes.getNamedItem("depthing"))?parseInt(temp.value):newDepthing;
	newCollidable = (temp=attributes.getNamedItem("collidable"))?temp.value!="false":newCollidable;
	newState = (temp=attributes.getNamedItem("state"))?temp.value:newState;
	
 	var newSprite = new Sprite(newName,newX,newY,newWidth,newHeight,newDx,newDy,newDepthing,newCollidable);
	
	var anims = spriteNode.getElementsByTagName("Animation");
	for(var j=0;j<anims.length;j++){
		var newAnim = Sburb.parseAnimation(anims[j],assetFolder);
		newSprite.addAnimation(newAnim);
		if(newState==null){
			newState = newAnim.name;
		}
	}
	newSprite.startAnimation(newState);
	
	return newSprite;
}




Sburb.Sprite = Sprite;

return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




////////////////////////////////////////
//Fighter Class (inherits Sprite)
////////////////////////////////////////

//Fighter
Sburb.Fighter = function(name,x,y,width,height){
	Sburb.Sprite.call(this,name,x,y,width,height,null,null,Sburb.Sprite.prototype.MG_DEPTHING,true);
	
	this.accel = 1.5;
	this.decel = 1;
	this.friction = 0.87;
	this.vx = 0;
	this.vy = 0;
	this.facing = "Right";
}

Sburb.Fighter.prototype = new Sburb.Sprite();

//update the Fighter one frame
Sburb.Fighter.prototype.update = function(curRoom){
	this.tryToMove(curRoom);
	Sburb.Sprite.prototype.update.call(this,curRoom);
	this.animation.flipX = (this.facing=="Left");
}

//parse keyboard input into movements
Sburb.Fighter.prototype.handleInputs = function(pressed){
	var moved = false;
	if(pressed[Sburb.Keys.down] || pressed[Sburb.Keys.s]){
		this.moveDown(); moved = true;
	}else if(pressed[Sburb.Keys.up] || pressed[Sburb.Keys.w]){
		this.moveUp(); moved = true;
	}
	if(pressed[Sburb.Keys.left] || pressed[Sburb.Keys.a]){
		this.moveLeft(); moved = true;
	}else if(pressed[Sburb.Keys.right] || pressed[Sburb.Keys.d]){
		this.moveRight(); moved = true;
	}
	if(pressed[Sburb.Keys.space] || pressed[Sburb.Keys.enter] || pressed[Sburb.Keys.ctrl]){
		this.attack();
	}
	if(!moved){
		this.idle();
	}
}

//stand still
Sburb.Fighter.prototype.idle = function(){
	if(this.state=="walk"){
		this.startAnimation("idle");
	}
}

//walk
Sburb.Fighter.prototype.walk = function(){
	if(this.state=="idle"){
		this.startAnimation("walk");
	}
}

//attack
Sburb.Fighter.prototype.attack = function(){
	this.startAnimation("attack");
}

//impulse fighter to move up
Sburb.Fighter.prototype.moveUp = function(){
	this.walk();
	this.vy-=this.accel;
}
//impulse fighter to move down
Sburb.Fighter.prototype.moveDown = function(){
	this.walk();
	this.vy+=this.accel;
}
//impulse fighter to move left
Sburb.Fighter.prototype.moveLeft = function(){
	this.walk();
	this.vx-=this.accel;
	this.facing = "Left";
}
//impulse fighter to move right
Sburb.Fighter.prototype.moveRight = function(){
	this.walk();
	this.vx+=this.accel;
	this.facing = "Right";
}
Sburb.Fighter.prototype.moveNone = function(){

}

//behave as a PC
Sburb.Fighter.prototype.becomePlayer = function(){

}

//behave as an NPC
Sburb.Fighter.prototype.becomeNPC = function(){
}

//get all the locations the Fighter would wich to query for actions
Sburb.Fighter.prototype.getActionQueries = function(){
	var queries = [];
	return queries;
}

//determine if the Fighter collides with the given sprite, if it were offset by dx,dy
Sburb.Fighter.prototype.collides = function(sprite,dx,dy){
	if(!this.width || !sprite.width){
		return false;
	}
	var x1 = this.x+(dx?dx:0);
	var y1 = this.y+(dy?dy:0);
	var w1 = this.width/2;
	var h1 = this.height/2;
	
	var x2 = sprite.x;
	var y2 = sprite.y;
	var w2 = sprite.width/2;
	var h2 = sprite.height/2;
	
	var xDiff = x2-x1;
	var yDiff = y2-y1;
	return Math.sqrt(xDiff*xDiff/w2/w1+yDiff*yDiff/h2/h1)<2;
}

//get the points where the Fighter might collide with something
Sburb.Fighter.prototype.getBoundaryQueries = function(dx,dy){
	var x = this.x+(dx?dx:0);
	var y = this.y+(dy?dy:0);
	var queries = {};
	var queryCount = 8;
	var angleDiff = 2*Math.PI/queryCount;
	for(var i=0,theta=0;i<queryCount;i++,theta+=angleDiff){
		queries[i] = {x:x+Math.cos(theta)*this.width/2 ,y:y+Math.sin(theta)*this.height/2};
	}
	return queries;
}

//try to move through the room
Sburb.Fighter.prototype.tryToMove = function(room){
	this.vx*=this.friction;
	this.vy*=this.friction;
	if(Math.abs(this.vx)<this.decel){
		this.vx = 0;
	}
	if(Math.abs(this.vy)<this.decel){
		this.vy = 0;
	}
	var vx = this.vx;
	var vy = this.vy;
	
	var i;
	var moveMap = room.getMoveFunction(this);
	var wasShifted = false;
	if(moveMap) { //our motion could be modified somehow
		l = moveMap(vx, vy);
		if(vx!=l.x || vy!=l.y){
			wasShifted = true;
		}
		vx = l.x;
		vy = l.y;
	}
	var dx = vx;
	var dy = vy;
	this.x+=vx;
	this.y+=vy;
	
	var collides = room.collides(this);
	if(collides){
		var tx = 0;
		var ty = 0;
		var theta = Math.atan2(this.y-collides.y,this.x-collides.x);
		var xOff = Math.cos(theta);
		var yOff = Math.sin(theta);
		while(this.collides(collides,tx,ty)){
			tx-=(dx-xOff)*0.1;
			ty-=(dy-yOff)*0.1;
		}
		if(room.collides(this,tx,ty)){
			this.x-=dx;
			this.y-=dy;
			return false;
		}
		this.x+=tx;
		this.y+=ty;
		dx+=tx;
		dy+=ty;
		
		var theta = Math.atan2(this.y-collides.y,this.x-collides.x);
		this.vx += tx;
		this.vy += ty;
		this.vx*=0.9;
		this.vy*=0.9;
	}

	var queries = room.isInBoundsBatch(this.getBoundaryQueries());
	var queryCount = 8;
	var collided = false;
	var hitX = 0;
	var hitY = 0;
	var angleDiff = 2*Math.PI/queryCount;
	for(var i=0,theta=0;i<queryCount;i++,theta+=angleDiff){
		var query = queries[i];
		if(!query){
			hitX+=Math.cos(theta);
			hitY+=Math.sin(theta);
			collided = true;
		}
	}
	
	if(collided){
		var tx = 0;
		var ty = 0;
		var theta = Math.atan2(hitY,hitX);
		var xOff = Math.cos(theta);
		var yOff = Math.sin(theta);
		var timeout = 0;
		while(!room.isInBounds(this,tx,ty) && timeout<20){
			tx-=xOff*2;
			ty-=yOff*2;
			timeout++;
		}
		if(timeout>=20 || room.collides(this,tx,ty)){
			console.log(tx,ty);
			this.x-=dx;
			this.y-=dy;
			return false;
		}
		this.x+=tx;
		this.y+=ty;
		dx+=tx;
		dy+=ty;
		
		this.vx += tx;
		this.vy += ty;
		this.vx*=0.9;
		this.vy*=0.9;
	}
	return true;
}

//serialize this Fighter to XML
Sburb.Fighter.prototype.serialize = function(output){
	var animationCount = 0;
	for(anim in this.animations){
			animationCount++;
	}
	output = output.concat("<Fighter "+
		Sburb.serializeAttributes(this,"name","x","y","width","height","facing")+
		(animationCount>1?"state='"+this.state+"' ":"")+
		">");
	for(animation in this.animations){
		output = this.animations[animation].serialize(output);
	}
	for(action in this.actions){
		output = this.actions[action].serialize(output);
	}
	output = output.concat("</Fighter>");
	return output;
}







//////////////////////////////////////////
//Related Utility Functions
//////////////////////////////////////////


Sburb.parseFighter = function(spriteNode, assetFolder) {
	var attributes = spriteNode.attributes;
	
	var newName = null;
	var newX = 0;
	var newY = 0;
	var newWidth = 0;
	var newHeight = 0;
	var newState = null;

	var temp;
	newName = (temp=attributes.getNamedItem("name"))?temp.value:newName;
	newX = (temp=attributes.getNamedItem("x"))?parseInt(temp.value):newX;
	newY = (temp=attributes.getNamedItem("y"))?parseInt(temp.value):newY;
	newWidth = (temp=attributes.getNamedItem("width"))?parseInt(temp.value):newWidth;
	newHeight = (temp=attributes.getNamedItem("height"))?parseInt(temp.value):newHeight;
	newState = (temp=attributes.getNamedItem("state"))?temp.value:newState;
	var newFacing = (temp=attributes.getNamedItem("facing"))?temp.value:"Right";
 	var newSprite = new Sburb.Fighter(newName,newX,newY,newWidth,newHeight);
	newSprite.facing = newFacing;
	var anims = spriteNode.getElementsByTagName("Animation");
	for(var j=0;j<anims.length;j++){
		var newAnim = Sburb.parseAnimation(anims[j],assetFolder);
		newSprite.addAnimation(newAnim);
		if(newState==null){
			newState = newAnim.name;
		}
	}
	newSprite.startAnimation(newState);
	
	return newSprite;
}

return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){



///////////////////////////////////////
//Chracter Class (inherits Sprite)
///////////////////////////////////////

//constructor
Sburb.Character = function(name,x,y,width,height,sx,sy,sWidth,sHeight,sheet,bootstrap){
	Sburb.Sprite.call(this,name,x,y,width,height,null,null,Sburb.Sprite.prototype.MG_DEPTHING,true);

	this.speed = 9;
	this.vx = 0;
	this.vy = 0;
	this.facing = "Front";
	this.npc = true;
	this.spriteType = "character";
	
	if(!bootstrap){ //automagically generate standard animations
		sWidth = typeof sWidth == "number" ? sWidth : width;
		sHeight = typeof sHeight == "number" ? sHeight : height;

		this.addAnimation(new Sburb.Animation("idleFront",sheet,sx,sy,sWidth,sHeight,0,1,2));
		this.addAnimation(new Sburb.Animation("idleRight",sheet,sx,sy,sWidth,sHeight,1,1,2));
		this.addAnimation(new Sburb.Animation("idleBack",sheet,sx,sy,sWidth,sHeight,2,1,2));
		this.addAnimation(new Sburb.Animation("idleLeft",sheet,sx,sy,sWidth,sHeight,3,1,2));
		this.addAnimation(new Sburb.Animation("walkFront",sheet,sx,sy,sWidth,sHeight,4,2,4));
		this.addAnimation(new Sburb.Animation("walkRight",sheet,sx,sy,sWidth,sHeight,6,2,4));
		this.addAnimation(new Sburb.Animation("walkBack",sheet,sx,sy,sWidth,sHeight,8,2,4));
		this.addAnimation(new Sburb.Animation("walkLeft",sheet,sx,sy,sWidth,sHeight,10,2,4));
	

		this.startAnimation("walkFront");
	}else{
		this.bootstrap = true;
	}
	
	this.becomeNPC();

}

Sburb.Character.prototype = new Sburb.Sprite();

//update as if one frame has passed
Sburb.Character.prototype.update = function(curRoom){
	this.tryToMove(this.vx,this.vy,curRoom);
	Sburb.Sprite.prototype.update.call(this,curRoom);
}

//impulse character to move up
Sburb.Character.prototype.moveUp = function(){
	this.facing = "Back";
	this.walk();
	this.vx = 0; this.vy = -this.speed;
}

//impulse character to move down
Sburb.Character.prototype.moveDown = function(){
	this.facing = "Front";
	this.walk();
	this.vx = 0; this.vy = this.speed;
}

//impulse character to move left
Sburb.Character.prototype.moveLeft = function(){
	this.facing = "Left";
	this.walk();
	this.vx = -this.speed; this.vy = 0;
}

//impulse character to move right
Sburb.Character.prototype.moveRight = function(){
	this.facing = "Right";
	this.walk();
	this.vx = this.speed; this.vy = 0;
}

//impulse character to stand still
Sburb.Character.prototype.moveNone = function(){
	this.idle();
	this.vx = 0; this.vy = 0;
}

//make character walk
Sburb.Character.prototype.walk = function(){
	this.startAnimation("walk"+this.facing);
}

//make character idle
Sburb.Character.prototype.idle = function(){
	this.startAnimation("idle"+this.facing);
}

//behave as an NPC
Sburb.Character.prototype.becomeNPC = function(){
	this.animations.walkFront.frameInterval = 12;
	this.animations.walkBack.frameInterval = 12;
	this.animations.walkLeft.frameInterval = 12;
	this.animations.walkRight.frameInterval = 12;
}

//behave as a PC
Sburb.Character.prototype.becomePlayer = function(){
	this.animations.walkFront.frameInterval = 4;
	this.animations.walkBack.frameInterval = 4;
	this.animations.walkLeft.frameInterval = 4;
	this.animations.walkRight.frameInterval = 4;
}

//parse key inputs into actions
Sburb.Character.prototype.handleInputs = function(pressed){
	if(pressed[Sburb.Keys.down] || pressed[Sburb.Keys.s]){
		this.moveDown();
	}else if(pressed[Sburb.Keys.up] || pressed[Sburb.Keys.w]){
		this.moveUp();
	}else if(pressed[Sburb.Keys.left] || pressed[Sburb.Keys.a]){
		this.moveLeft();
	}else if(pressed[Sburb.Keys.right] || pressed[Sburb.Keys.d]){
		this.moveRight();
	}else{
		this.moveNone();
	}
}

//have character try to move through room
Sburb.Character.prototype.tryToMove = function(vx,vy,room){
	var i;
	var moveMap = room.getMoveFunction(this);
	var wasShifted = false;
	if(moveMap) { //our motion could be modified somehow
		l = moveMap(vx, vy);
		if(vx!=l.x || vy!=l.y){
			wasShifted = true;
		}
		vx = l.x;
		vy = l.y;
	}
	var minX = Stage.scaleX;
	var minY = Stage.scaleY;
	while(Math.abs(vx)>=minX || Math.abs(vy)>=minY){
		var dx = 0;
		var dy = 0;
		if(Math.abs(vx)>=minX){
			dx=Math.round((minX)*vx/Math.abs(vx));
			this.x+=dx;
			vx-=dx;
		}
		if(Math.abs(vy)>=minY){
			dy=Math.round((minY)*vy/Math.abs(vy));
			this.y+=dy;
			vy-=dy;
		}
		
		var collision;
		if(collision = room.collides(this)){
			var fixed = false;
			if(dx!=0){
				if(!this.collides(collision,0,minY)){
					dy+=minY;
					this.y+=minY;
					fixed = true;
				}else if(!this.collides(collision,0,-minY)){
					dy-=minY;
					this.y-=minY;
					fixed = true;
				}
			}
			if(!fixed && dy!=0){
				if(!this.collides(collision,minX,0)){
					dx+=minX;
					this.x+=minX;
					fixed = true;
				}else if(!this.collides(collision,-minX,0)){
					dx-=minX;
					this.x-=minX;
					fixed = true;
				}
			}
			if(!fixed || room.collides(this)){
				this.x-=dx;
				this.y-=dy;
				return false;
			}
		}
		
		if(!room.isInBounds(this)){
			var fixed = false;
			if(dx!=0){
				if(room.isInBounds(this,0,minY)){
					dy+=minY;
					this.y+=minY;
					fixed = true;
				}else if(room.isInBounds(this,0,-minY)){
					dy-=minY;
					this.y-=minY;
					fixed = true;
				}
			}
			if(!fixed && dy!=0){
				if(room.isInBounds(this,minX,0)){
					dx+=minX;
					this.x+=minX;
					fixed = true;
				}else if(room.isInBounds(this,-minX,0)){
					dx-=minX;
					this.x-=minX;
					fixed = true;
				}
			}
			if(!fixed || room.collides(this)){
				this.x-=dx;
				this.y-=dy;
				return false;
			}
		}
	}	
	return true;
}

//get locations character wishes to query for actions
Sburb.Character.prototype.getActionQueries = function(){
	var queries = [];
	queries.push({x:this.x,y:this.y});
	if(this.facing=="Front"){
		queries.push({x:this.x,y:this.y+(this.height/2+15)});
		queries.push({x:this.x-this.width/2,y:this.y+(this.height/2+15)});
		queries.push({x:this.x+this.width/2,y:this.y+(this.height/2+15)});
	}else if(this.facing=="Back"){
		queries.push({x:this.x,y:this.y-(this.height/2+15)});
		queries.push({x:this.x-this.width/2,y:this.y-(this.height/2+15)});
		queries.push({x:this.x+this.width/2,y:this.y-(this.height/2+15)});
	}else if(this.facing=="Right"){
		queries.push({x:this.x+(this.width/2+15),y:this.y});
		queries.push({x:this.x+(this.width/2+15),y:this.y+this.height/2});
		queries.push({x:this.x+(this.width/2+15),y:this.y-this.height/2});
	}else if(this.facing=="Left"){
		queries.push({x:this.x-(this.width/2+15),y:this.y});
		queries.push({x:this.x-(this.width/2+15),y:this.y+this.height/2});
		queries.push({x:this.x-(this.width/2+15),y:this.y-this.height/2});
	}
	return queries;
}

//serialize character to XML
Sburb.Character.prototype.serialize = function(output){
	output = output.concat("\n<Character name='"+this.name+
		"' x='"+this.x+
		"' y='"+this.y+
		"' width='"+this.width+
		"' height='"+this.height+
		"' state='"+this.state+
		"' facing='"+this.facing);
		if(!this.bootstrap){
			output = output.concat("' sx='"+this.animations.walkFront.x+
			"' sy='"+this.animations.walkFront.y+
			"' sWidth='"+this.animations.walkFront.colSize+
			"' sHeight='"+this.animations.walkFront.rowSize+
			"' sheet='"+this.animations.walkFront.sheet.name);
		}else{
			output = output.concat("' bootstrap='true");
		}
		output = output.concat("'>");
	for(var animation in this.animations){
		var anim = this.animations[animation];
		if(this.bootstrap || (anim.name.indexOf("idle")==-1 && anim.name.indexOf("walk")==-1)){
			output = anim.serialize(output);
		}
	}
	for(var action in this.actions){
		output = this.actions[action].serialize(output);
	}
	
	output = output.concat("\n</Character>");
	return output;
}









////////////////////////////////////////////
//Related Utiltity functions
////////////////////////////////////////////

//parse character from XML DOM Node
Sburb.parseCharacter = function(charNode, assetFolder) {
  	var attributes = charNode.attributes;
  	var newChar = new Sburb.Character(attributes.getNamedItem("name").value,
  				    attributes.getNamedItem("x")?parseInt(attributes.getNamedItem("x").value):0,
  				    attributes.getNamedItem("y")?parseInt(attributes.getNamedItem("y").value):0,
  				    parseInt(attributes.getNamedItem("width").value),
  				    parseInt(attributes.getNamedItem("height").value),
  				    attributes.getNamedItem("sx")?parseInt(attributes.getNamedItem("sx").value):0,
  				    attributes.getNamedItem("sy")?parseInt(attributes.getNamedItem("sy").value):0,
  				    parseInt(attributes.getNamedItem("sWidth").value),
  				    parseInt(attributes.getNamedItem("sHeight").value),
  				    assetFolder[attributes.getNamedItem("sheet").value]);
  				    
  	var anims = charNode.getElementsByTagName("Animation");
	for(var j=0;j<anims.length;j++){
		var newAnim = Sburb.parseAnimation(anims[j],assetFolder);
		newChar.addAnimation(newAnim); 
	}
  	newChar.startAnimation(attributes.getNamedItem("state").value);
  	newChar.facing = attributes.getNamedItem("facing").value;
	return newChar;
}




return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




///////////////////////////////////////////
//SpriteButton class
///////////////////////////////////////////

//constructor
Sburb.SpriteButton = function(name,x,y,width,height,sheet,action){
	Sburb.Sprite.call(this,name,x,y,width,height);
	
	this.pressed = false;
	this.mousePressed = false;
	this.clicked = false;
	this.action?action:null;
	
	for(var i=0;i<(sheet.width/this.width)*(sheet.height/this.height);i++){
		this.addAnimation(new Sburb.Animation("state"+i,sheet,0,0,width,height,i,1,1000));
	}
	
	this.startAnimation("state0");
}

Sburb.SpriteButton.prototype = new Sburb.Sprite();

//update button in relation to mouse state
Sburb.SpriteButton.prototype.updateMouse = function(x,y,mouseDown){
	this.clicked = false;
	if(mouseDown){
		if(!this.mousePressed){
			this.mousePressed = true;
			if(this.hitsPoint(x-this.width/2,y-this.height/2)){
				this.pressed = true;
			}
		}
	}else{
		if(this.pressed){
			if(this.hitsPoint(x-this.width/2,y-this.height/2)){
				this.clicked = true;
				var nextState = "state"+(parseInt(this.animation.name.substr(5,1))+1);
				if(this.animations[nextState]){
					this.startAnimation(nextState);
				}else{
					this.startAnimation("state0");
				}
			}
		}
		this.pressed = false;
		this.mousePressed = false;
	}
}

//serialize this SpriteButton to XML
Sburb.SpriteButton.prototype.serialize = function(output){
	output = output.concat("\n<SpriteButton name='"+this.name+
		(this.x?"' x='"+this.x:"")+
		(this.y?"' y='"+this.y:"")+
		"' width='"+this.width+
		"' height='"+this.height+
		"' sheet='"+this.animation.sheet.name+
		"' >");
	if(this.action){
		output = this.action.serialize(output);
	}
	output = output.concat("</SpriteButton>");
	return output;
}




///////////////////////////////////////////////
//Related Utility Functions
///////////////////////////////////////////////

//Parse a SpriteButton from XML
Sburb.parseSpriteButton = function(button){
	var attributes = button.attributes;
	var newButton = new Sburb.SpriteButton(attributes.getNamedItem("name").value,
  									attributes.getNamedItem("x")?parseInt(attributes.getNamedItem("x").value):0,
  									attributes.getNamedItem("y")?parseInt(attributes.getNamedItem("y").value):0,
  									parseInt(attributes.getNamedItem("width").value),
  									parseInt(attributes.getNamedItem("height").value),
  									Sburb.assets[attributes.getNamedItem("sheet").value]);
  	var curAction = button.getElementsByTagName("Action");
  	if(curAction){
  		var newAction = Sburb.parseAction(curAction[0]);
  		newButton.action = newAction;
  	}
  	return newButton;
}




return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




////////////////////////////////////
//Animation Class
////////////////////////////////////


//Constructor
Sburb.Animation = function(name,sheet,x,y,colSize,rowSize,startPos,length,frameInterval,loopNum,followUp,flipX,flipY){
	this.sheet = sheet;
	this.x = x;
	this.y = y;
	this.rowSize = rowSize;
	this.colSize = colSize;
	this.startPos = startPos;
	this.length = length;
	this.frameInterval = frameInterval;
	this.curInterval = 0;
	this.curFrame = 0;
	this.numRows = sheet.height/rowSize;
	this.numCols = sheet.width/colSize;
	this.name = name;
	this.loopNum = typeof loopNum == "number"?loopNum:-1;
	this.curLoop = 0;
	this.followUp = followUp;
	this.flipX = flipX?true:false;
	this.flipY = flipY?true:false;
}


//go to the next frame of the animation
Sburb.Animation.prototype.nextFrame = function() {
	this.curFrame++;
	if(this.curFrame>=this.length){
		if(this.curLoop==this.loopNum){
			this.curFrame = this.length-1;
		}else{
			this.curFrame=0;
			if(this.loopNum>=0){
				this.curLoop++;
			}
		}
	}
}

//update the animation as if a frame of time has elapsed
Sburb.Animation.prototype.update = function(){
	this.curInterval++;
	while(this.curInterval>this.frameInterval){
		this.curInterval-=this.frameInterval;
		this.nextFrame();
	}
}

//draw the animation
Sburb.Animation.prototype.draw = function(x,y){
	var Stage = Sburb.Stage;
	var stage = Sburb.stage;
	var stageX = Stage.offset?Stage.x:0;
	var stageY = Stage.offset?Stage.y:0;
	var stageWidth = Stage.width;
	var stageHeight = Stage.height;
	
	if(this.flipX){
		stageX = -stageX-stageWidth;
		x = -x;
	}
	if(this.flipY){
		stageY = -stageY-stageHeight;
		y = -y;
	}
	
	x= Math.round((this.x+x)/Stage.scaleX)*Stage.scaleX;
	y= Math.round((this.y+y)/Stage.scaleY)*Stage.scaleY;

	var colNum = ((this.startPos+this.curFrame)%this.numCols);
	var rowNum = (Math.floor((this.startPos+this.curFrame-colNum)/this.numRows));
	var frameX = colNum*this.colSize;
	var frameY = rowNum*this.rowSize;
	var drawWidth = this.colSize;
	var drawHeight = this.rowSize;
	
	
	
	var delta = x-stageX;
	if(delta<0){
		frameX-=delta;
		drawWidth+=delta;
		x=stageX;
		if(frameX>=this.sheet.width){
			return;
		}
	}
	
	delta = y-stageY;
	if(delta<0){
		frameY-=delta;
		drawHeight+=delta;
		y=stageY;
		if(frameY>=this.sheet.height){
			return;
		}
	}
	
	
	
	
	delta = drawWidth+x-stageX-stageWidth;
	if(delta>0){
		drawWidth-=delta;
		
	}
	if(drawWidth<=0){
		return;
	}
	
	delta = drawHeight+y-stageY-stageHeight;
	if(delta>0){
		drawHeight-=delta;
	}
	if(drawHeight<=0){
		return;
	}
	
	var scaleX = 1;
	var scaleY = 1;
	
	if(this.flipX){
		scaleX = -1;
	}
	if(this.flipY){
		scaleY = -1;
	}
	if(scaleX!=1 || scaleY!=1){
		stage.scale(scaleX,scaleY);
	}
	stage.drawImage(this.sheet,frameX,frameY,drawWidth,drawHeight,x,y,drawWidth,drawHeight);
	if(scaleX!=1 || scaleY!=1){
		stage.scale(scaleX,scaleY);
	}
}

//reinitialize the animation to its first frame and loop
Sburb.Animation.prototype.reset = function(){
	this.curFrame = 0;
	this.curInterval = 0;
	this.curLoop = 0;
}

//has the animation stopped playing
Sburb.Animation.prototype.hasPlayed = function(){
	return this.curLoop == this.loopNum && this.curFrame==this.length-1;
}

//set the column size (width)
Sburb.Animation.prototype.setColSize = function(newSize){
	this.colSize = newSize;
	this.numCols = this.sheet.width/this.colSize;
	this.reset();
}

//set the row size (height)
Sburb.Animation.prototype.setRowSize = function(newSize){
	this.rowSize = newSize;
	this.numRows = this.sheet.height/this.rowSize;
	this.reset();
}

//set the sheet
Sburb.Animation.prototype.setSheet = function(newSheet){
	this.sheet = newSheet;
	this.numRows = this.sheet.height/this.rowSize;
	this.numCols = this.sheet.width/this.colSize;
	this.reset();
}

//does the image render in the given pixel
Sburb.Animation.prototype.isVisuallyUnder = function(x,y){
	if(x>=this.x && x<=this.x+this.colSize){
		if(y>=this.y && y<=this.y+this.rowSize){
			return true;
		}
	}
	return false;
}

//make an exact copy of this animation
Sburb.Animation.prototype.clone = function(x,y){
	return new Sburb.Animation(this.name, this.sheet, x+this.x, y+this.y, this.colSize,this.rowSize, this.startPos, this.length, this.frameInterval, this.loopNum);
}

//serialize this Animation to XML
Sburb.Animation.prototype.serialize = function(output){
	output = output.concat("\n<Animation "+
		("sheet='"+this.sheet.name+"' ")+
		((this.name!="image")?"name='"+this.name+"' ":"")+
		Sburb.serializeAttributes(this,"x","y")+
		((this.rowSize!=this.sheet.height)?"rowSize='"+this.rowSize+"' ":"")+
		((this.colSize!=this.sheet.width)?"colSize='"+this.colSize+"' ":"")+
		Sburb.serializeAttribute(this,"startPos")+
		((this.length!=1)?"length='"+this.length+"' ":"")+
		((this.frameInterval!=1)?"frameInterval='"+this.frameInterval+"' ":"")+
		((this.loopNum!=-1)?"loopNum='"+this.loopNum+"' ":"")+
		Sburb.serializeAttributes(this,"folowUp","flipX","flipY")+
		" />");
	return output;
}







///////////////////////////////////////
//Related Utility functions
///////////////////////////////////////

Sburb.parseAnimation = function(animationNode, assetFolder){
	var attributes = animationNode.attributes;

	var name = "image";
	var sheet = null;
	var x = 0;
	var y = 0;
	var colSize = null;
	var rowSize = null;
	var startPos = 0;
	var length = 1;
	var frameInterval = 1;
	var loopNum = -1;
	var followUp = null;
	
	var temp;
	name = (temp = attributes.getNamedItem("name"))?temp.value:name;
	sheet = (temp = attributes.getNamedItem("sheet"))?assetFolder[temp.value]:sheet;
	x = (temp = attributes.getNamedItem("x"))?parseInt(temp.value):x;
	y = (temp = attributes.getNamedItem("y"))?parseInt(temp.value):y;
	length = (temp = attributes.getNamedItem("length"))?parseInt(temp.value):length;
	colSize = (temp = attributes.getNamedItem("colSize"))?parseInt(temp.value):Math.round(sheet.width/length);
	rowSize = (temp = attributes.getNamedItem("rowSize"))?parseInt(temp.value):sheet.height;
	startPos = (temp = attributes.getNamedItem("startPos"))?parseInt(temp.value):startPos;
	
	frameInterval = (temp = attributes.getNamedItem("frameInterval"))?parseInt(temp.value):frameInterval;
	loopNum = (temp = attributes.getNamedItem("loopNum"))?parseInt(temp.value):loopNum;
	followUp = (temp = attributes.getNamedItem("followUp"))?temp.value:followUp;
	var flipX = (temp = attributes.getNamedItem("flipX"))?temp.value!="false":false;
	var flipY = (temp = attributes.getNamedItem("flipY"))?temp.value!="false":false;
	
	return new Sburb.Animation(name,sheet,x,y,colSize,rowSize,startPos,length,frameInterval,loopNum,followUp,flipX,flipY);
}

return Sburb;
})(Sburb || {});
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
}

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
Sburb.Room.prototype.addMotionPath = function(path, xtox,xtoy,ytox,ytoy,dx,dy) {
	var motionPath = new function (){
		this.path = path;
		this.xtox = xtox; this.xtoy = xtoy;
		this.ytox = ytox; this.ytoy = ytoy;
		this.dx = dx; this.dy = dy;
	};
	this.motionPaths.push(motionPath);
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
	output = output.concat("\n<Room name='"+this.name+"' width='"+this.width+"' height='"+this.height+"'>");
	output = output.concat("\n<Paths>");
	for(var i=0;i<this.walkables.length;i++){
		var walkable = this.walkables[i];
		output = output.concat("\n<Walkable path='"+walkable.name+"'/>");
	}
	for(var i=0;i<this.unwalkables.length;i++){
		var unwalkable = this.unwalkables[i];
		output = output.concat("\n<Unwalkable path='"+unwalkable.name+"'/>");
	}
	for(var i=0;i<this.motionPaths.length;i++){
		var motionPath = this.motionPaths[i];
		 output = output.concat("\n<MotionPath path='"+motionPath.path.name+"' xtox='"+motionPath.xtox+"' xtoy='"+motionPath.xtoy+
		 "' ytox='"+motionPath.ytox+"' ytoy='"+motionPath.ytoy+"' dx='"+motionPath.dx+"' dy='"+motionPath.dy+"'/>");
	}
	output = output.concat("\n</Paths>");
	output = output.concat("\n<Triggers>");
	for(var i=0;i<this.triggers.length;i++){
		otuput = this.triggers[i].serialize(output);
	}
	output = output.concat("\n</Triggers>");
	for(var sprite in this.sprites){
		output = this.sprites[sprite].serialize(output);
	}
	
	output = output.concat("\n</Room>");
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
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("Sprite"), spriteFolder);
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("Character"), spriteFolder);
  	Sburb.serialLoadRoomSprites(newRoom,roomNode.getElementsByTagName("Fighter"), spriteFolder);
	Sburb.serialLoadRoomPaths(newRoom, roomNode.getElementsByTagName("Paths"), assetFolder);
	Sburb.serialLoadRoomTriggers(newRoom,roomNode.getElementsByTagName("Triggers"),spriteFolder);
	return newRoom;
}



return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){

/* Talking text markup
@ denotes a new dialogue box, the string following it indicates character animation, 
the first two characters indicating character specific formatting.
Alternatively, you can use an underscore to override the two character identifier
limit.

EX:

@CGIdle wordwordswords
@TTAngry Blahblahblah
@CGBored snoooooze
@Karkat_Stupid blarhagahl

Inserting underscores underlines the text between them, e.g. _blah blah blah_
Inserting /0xff00ff colours all following text with the specificed colour.
Insterting /0x/ ends the previously specified behaviour.
*/







////////////////////////////////////////////////
//FontEngine class
////////////////////////////////////////////////

//constructor
Sburb.FontEngine = function(text){
	//This is intended for monospace fonts
	this.font = "bold 14px Courier New";
	this.color = "#000000";
	this.text = typeof text == "string"?text:"";
	this.x=0;
	this.y=0;
	this.width=999999;
	this.height=999999;
	this.start=0;
	this.end=999999;
	this.lines = [];
	this.lineHeight = 17;
	this.charWidth = 8;
	
	this.formatQueue = [];
}

Sburb.FontEngine.prototype.prefixColours = {	
	aa : "#a10000",aradia : "#a10000",
	ac : "#416600",nepeta : "#416600",
	ag : "#005682",vriska : "#005682",
	at : "#a15000",tavros : "#a15000",
	ca : "#6a006a",eridan : "#6a006a",
	cc : "#77003c",feferi : "#77003c",
	cg : "#626262",karkat : "#626262",
	ct : "#000056",equius : "#000056",
	ga : "#008141",kanaya : "#008141",
	gc : "#008282",terezi : "#008282",
	ta : "#a1a100",sollux : "#a1a100",
	tc : "#2b0057",gamzee : "#2b0057"
};

//set the style
Sburb.FontEngine.prototype.setStyle = function(font,color,lineHeight,charWidth){
	this.font = typeof font == "string" ? font:this.font;
	this.color = typeof color == "string" ? color:this.color;
	this.lineHeight = typeof lineHeight == "number" ? lineHeight:this.lineHeight;
	this.charWidth = typeof charWidth == "number" ? charWidth:this.charWidth;
	this.parseText();
}

//set the text
Sburb.FontEngine.prototype.setText = function(text){
	this.text = text;
	this.parseEverything();
}

//show a substring of the text
Sburb.FontEngine.prototype.showSubText = function(start,end){
	this.start = typeof start == "number" ? start:this.start;
	this.end = typeof end == "number" ? end:this.end;
}

//set the dimensions
Sburb.FontEngine.prototype.setDimensions = function(x,y,width,height){
	this.x = typeof x == "number" ? x:this.x;
	this.y = typeof y == "number" ? y:this.y;
	this.width = typeof width == "number" ? width:this.width;
	this.height = typeof height == "number" ? height:this.height;
	this.parseText();
}

//parse and format the current text with the current settings
Sburb.FontEngine.prototype.parseEverything = function(){
	this.parseFormatting();
	this.parseText();
}

//parse the text
Sburb.FontEngine.prototype.parseText = function(){ //break it up into lines
	this.lines = [];
	var i = 0;
	var lastSpace = 0;
	var lineStart = 0;
	for(i=0;i<this.text.length;i++){
		if(this.text.charAt(i)==" "){
			lastSpace = i;
		}else if(this.text.charAt(i)=="\n"){
			this.lines.push(this.text.substring(lineStart,i));
			lineStart = i+1;
			lastSpace = lineStart;
			continue;
		}
		if(i-lineStart>this.width/this.charWidth){
			if(lineStart==lastSpace){
				this.lines.push(this.text.substring(lineStart,i));
				lineStart = i;
				lastSpace = i;
			}else{
				this.lines.push(this.text.substring(lineStart,lastSpace));
				lineStart = lastSpace+1;
				lastSpace = lineStart;
			}
		}
	}
	this.lines.push(this.text.substring(lineStart,i));
}

//parse the formatting of the text
Sburb.FontEngine.prototype.parseFormatting = function(){
	this.formatQueue = [];
	var prefix = this.text.substring(0,this.text.indexOf(" "));
	var actor;
	if(prefix!="!"){
		if(prefix.indexOf("_")>=0){
			actor = prefix.substring(0,this.text.indexOf("_"));	
		}else{
			actor = prefix.substring(0,2);
		}
		this.parsePrefix(actor);
	}
	this.text = this.text.substring(this.text.indexOf(" ")+1,this.text.length);
	
	var index= this.text.indexOf("_");
	while(index>=0){
		var closing = false;
		for(var i=this.formatQueue.length-1;i>=0;i--){
			if(this.formatQueue[i].type=="underline" && this.formatQueue[i].maxIndex==999999){
				this.formatQueue[i].maxIndex=index;
				closing = true;
				break;
			}
		}
		if(!closing){
			this.addToFormatQueue(new Sburb.FormatRange(index,999999,"underline"));
		}
		this.text = this.text.substring(0,index)+this.text.substring(index+1,this.text.length);
		this.realignFormatQueue(index,1);
		index = this.text.indexOf("_");
	}
	index = this.text.indexOf("/0x");
	while(index>=0){
		if(this.text.indexOf("/0x/")==index){
			for(var i=this.formatQueue.length-1;i>=0;i--){
				if(this.formatQueue[i].type=="colour" && this.formatQueue[i].maxIndex==999999){
					this.formatQueue[i].maxIndex=index;
					break;
				}
			}
			this.text = this.text.substring(0,index)+this.text.substring(index+4,this.text.length);
			this.realignFormatQueue(index,4);
		}else{
			this.addToFormatQueue(new Sburb.FormatRange(index,999999,"colour","#"+this.text.substring(index+3,index+9)));
			this.text = this.text.substring(0,index)+this.text.substring(index+9,this.text.length);
			this.realignFormatQueue(index,9);
		}
		
		index = this.text.indexOf("/0x");
	}
}

//add a format object to the formatQueue
Sburb.FontEngine.prototype.addToFormatQueue = function(format){
	var newPlace = this.formatQueue.length;
	for(var i=0;i<this.formatQueue.length;i++){
		if(this.formatQueue[i].minIndex>format.minIndex){
			newPlace = i;
			break;
		}
	}
	this.formatQueue.splice(newPlace,0,format);
}

//clean up any descrepencies in the formatQueue
Sburb.FontEngine.prototype.realignFormatQueue = function(startPos,shiftSize){
	for(var i=0;i<this.formatQueue.length;i++){
		var curFormat = this.formatQueue[i];
		if(curFormat.maxIndex>startPos && curFormat.maxIndex!=999999){
			curFormat.maxIndex-=shiftSize;
		}
		if(curFormat.minIndex>startPos){
			curFormat.minIndex-=shiftSize;
		}
	}
}

//parse a dialog prefix into formats
Sburb.FontEngine.prototype.parsePrefix = function(prefix){
	this.formatQueue.push(new Sburb.FormatRange(0,this.text.length,"colour",this.prefixColouration(prefix)));
}

//get the colour of a prefix
Sburb.FontEngine.prototype.prefixColouration = function(prefix){
	if(this.prefixColours[prefix.toLowerCase()]){
		return this.prefixColours[prefix.toLowerCase()];
	}else{
		return "#000000";
	}
}

//get the next "box" of lines
Sburb.FontEngine.prototype.nextBatch = function(){
	this.realignFormatQueue(-1,this.batchLength());
	this.lines.splice(0,Math.min(this.lines.length,Math.floor(this.height/this.lineHeight)));
	return this.lines.length;
}

//draw the FontEngine
Sburb.FontEngine.prototype.draw = function(){

	var i;
	var lenCount;
	var linePos=0;
	var strStart,strEnd;
	var currentFormat = 0;
	var currentFormats = [];
	var nextStop;
	var curLine;
	Sburb.stage.save();
	if(Sburb.stage.textBaseline != "top"){
		Sburb.stage.textBaseline = "top";
	}
	i=0;
	lenCount=0;
	while(i<Math.floor(this.height/this.lineHeight) && i<this.lines.length){
		curLine = this.lines[i];
		var curFont = this.font;
		var curColor = this.color;
		var underlining = false;
		
		nextStop = curLine.length;
		
		if(currentFormat<this.formatQueue.length && this.formatQueue[currentFormat].minIndex<=lenCount+linePos){
			currentFormats.push(this.formatQueue[currentFormat]);
			currentFormat++;
		}
		for(var k=currentFormats.length-1;k>=0;k--){
			if(currentFormats[k].maxIndex<=lenCount+linePos){
				currentFormats.splice(k,1);
			}
		}
		for(var k=0;k<currentFormats.length;k++){
			if(currentFormats[k].type=="colour"){
				curColor = currentFormats[k].extra;
				
			}else if(currentFormats[k].type=="underline"){
				underlining = true;
			}else if(currentFormats[k].type=="italic"){
				curFont = "italic "+this.font;
			}
		}
		if(currentFormat<this.formatQueue.length && this.formatQueue[currentFormat].minIndex<lenCount+curLine.length){
			if(this.formatQueue[currentFormat].minIndex<this.end){
				nextStop = Math.min(nextStop,this.formatQueue[currentFormat].minIndex-lenCount);
			}
		}
		for(var k=0;k<currentFormats.length;k++){
			if(currentFormats[k].maxIndex<this.end){
				nextStop = Math.min(nextStop,currentFormats[k].maxIndex-lenCount);
			}
		}
		if(nextStop!=curLine.length){
			strStart = linePos;
			strEnd = nextStop;
			linePos+=strEnd-strStart;
		}else{
			if(lenCount+curLine.length<=this.end){ //if the line wouldn't take me past the displayed length
				strEnd = curLine.length; //do the whole line
			}else{ //otherwise, if the line would take me past the displayed length
				strEnd = this.end-lenCount; //only show up to the limit
			}
			if(lenCount+linePos>=this.start){ //if the start of the line is within the bounds of the displayed length
				strStart = linePos; //display from the start of the line
			}else if(lenCount+curLine.length>=this.start){ //otherwise, if any part of the line should be displayed
				strStart = this.start-(lenCount)+linePos; //display from where we should start
			}else{ //otherwise, don't show this line at all
				strStart = linePos;
				strEnd = linePos;
			}
			linePos = -1;
		}
		var startX = this.x+strStart*this.charWidth;
		var startY = this.y+i*this.lineHeight;
		if(Sburb.stage.font != curFont){
			Sburb.stage.font = curFont;
		}
		if(Sburb.stage.fillStyle!=curColor){
			Sburb.stage.strokeStyle = Sburb.stage.fillStyle = curColor;
		}
		Sburb.stage.fillText(curLine.substring(strStart,strEnd),startX,startY);
		if(underlining){
			if(Sburb.stage.lineWidth!=0.6){
				Sburb.stage.lineWidth = 0.6;
			}
			if(Sburb.stage.lineCap!="square"){
				Sburb.stage.lineCap = "square";
			}
			Sburb.stage.beginPath();
			Sburb.stage.moveTo(startX,startY+this.lineHeight-3);
			Sburb.stage.lineTo(startX+(strEnd-strStart)*this.charWidth,startY+this.lineHeight-3);
			Sburb.stage.closePath();
			Sburb.stage.stroke();
		}
		if(linePos==-1){
			lenCount+=this.lines[i].length;
			linePos = 0;
			i++;
		}
	}
	Sburb.stage.restore();
}

//is the contents of the current "box" fully displayed
Sburb.FontEngine.prototype.isShowingAll = function(){
	return this.end>=this.batchLength();
}

//get the length of the current "box"
Sburb.FontEngine.prototype.batchLength = function(){
	var len = 0;
	var i;
	for(i=0;i<Math.floor(this.height/this.lineHeight) && i<this.lines.length;i++){
		len+=this.lines[i].length;
	}
	return len;
}

//show the contents of the current "box"
Sburb.FontEngine.prototype.showAll = function(){
	this.end = this.batchLength();
}






////////////////////////////////////
//FormatRange class
////////////////////////////////////

Sburb.FormatRange = function(minIndex,maxIndex,type,extra){
	this.minIndex = minIndex;
	this.maxIndex = maxIndex;
	this.type = type;
	this.extra = typeof extra == "string"?extra:"";
}





return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




///////////////////////////////////////////////
//Action Class
///////////////////////////////////////////////

//Constructor
Sburb.Action = function(command,info,name,sprite,followUp,noWait,noDelay,times,soft,silent){
	this.sprite = sprite?sprite:null;
	this.name = name?name:null;
	this.command = command
	this.info = info;
	this.followUp = followUp?followUp:null;
	this.noWait = noWait?noWait:false;
	this.noDelay = noDelay?noDelay:false;
	this.soft = soft?soft:false;
	this.silent = silent?silent:false;
	this.times = times?times:1;
}

//Make an exact copy
Sburb.Action.prototype.clone = function(){
	return new Sburb.Action(this.command, this.info, this.name, this.sprite, this.followUp, this.noWait, this.noDelay, this.times, this.soft, this.silent);
}

//Serialize to XML (see serialization.js)
Sburb.Action.prototype.serialize = function(output){
	output = output.concat("\n<Action "+
		"command='"+this.command+
		(this.sprite?"sprite='"+this.sprite.name:"")+
		(this.name?"' name='"+this.name:"")+
		(this.noWait?"' noWait='"+this.noWait:"")+
		(this.noDelay?"' noDelay='"+this.noDelay:"")+
		(this.soft?"' soft='"+this.soft:"")+
		(this.silent?"' silent='"+this.silent:"")+
		(this.times!=1?"' times='"+this.times:"")+
		"'>");
	output = output.concat(this.info.trim());
	if(this.followUp){
		output = this.followUp.serialize(output);
	}
	output = output.concat("</Action>");
	return output;
}





//////////////////////////////////////////////////
//Related utility functions
//////////////////////////////////////////////////

//Parse a serialized Action from an XML DOM node
Sburb.parseAction = function(node) {
	var targSprite = null;
	var firstAction = null;
	var oldAction = null;
	do{
	  	var attributes = node.attributes;
		
		if(attributes.getNamedItem("sprite") && attributes.getNamedItem("sprite").value!="null"){
			targSprite = sprites[attributes.getNamedItem("sprite").value];
		}

		var newAction = new Sburb.Action(
					 attributes.getNamedItem("command").value,
					 node.firstChild?node.firstChild.nodeValue.trim():"",
					 attributes.getNamedItem("name")?attributes.getNamedItem("name").value:null,
					 targSprite,
					 null,
					 attributes.getNamedItem("noWait")?attributes.getNamedItem("noWait").value=="true":false,
					 attributes.getNamedItem("noDelay")?attributes.getNamedItem("noDelay").value=="true":false,
					 attributes.getNamedItem("times")?parseInt(attributes.getNamedItem("times").value):1,
					 attributes.getNamedItem("soft")?attributes.getNamedItem("soft").value=="true":false,
					 attributes.getNamedItem("silent")?attributes.getNamedItem("silent").value=="true":false);
					 
		if(oldAction){
			oldAction.followUp = newAction;
		}
		if(!firstAction){
			firstAction = newAction;
		}
		oldAction = newAction;
		var nodes = node.getElementsByTagName("Action");
		if(nodes){
			node = nodes[0];
		}else{
			break;
		}
	}while(node);
	
	return firstAction;
}

return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){






/////////////////////////////////////////
//Trigger Class
/////////////////////////////////////////

//constructor
Sburb.Trigger = function(info,action,followUp,restart,detonate){
	this.info = info;
	this.followUp = followUp?followUp:null;
	this.action = action?action:null;
	this.restart = restart?restart:false;
	this.detonate = detonate?detonate:false;
	this.type = null;
	
	this.reset();
}

//parse the trigger info into an actual event to watch
Sburb.Trigger.prototype.reset = function(){
	var params = this.info.split(",");
	this.type = params[0];

	if(this.type=="spriteProperty"){
		if(params[1]=="char"){
			this.entity = params[1];
		}else{
			this.entity = Sburb.sprites[params[1]];
		}
		var token;	
		var query = params[2];
		if(query.indexOf(">")>-1){
			token = ">";
			this.trigger = function(entity,property,target){
				return entity[property]>target;
			};		
		}else if(query.indexOf("<")>-1){
			token = "<";
			this.trigger = function(entity,property,target){
				return entity[property]<target;
			};		
		}else if(query.indexOf("=")>-1){
			token = "=";
			this.trigger = function(entity,property,target){
				return entity[property]==target;
			};		
		}
		var queryParts = query.split(token);
		this.property = queryParts[0].trim();
		this.target = parseInt(queryParts[1].trim());
	
		this.checkCompletion = function(){
			var entity = this.entity;
			if(this.entity=="char"){
				entity = Sburb.char;
			}
			return this.trigger(entity,this.property,this.target);
		}
	
	}else if(this.type=="time"){
		this.time = parseInt(params[1]);
	
		this.checkCompletion = function(){
			this.time--;
			return this.time<=0;
		};
	
	}else if(this.type=="played"){
		this.entity = Sburb.sprites[params[1]];
		this.checkCompletion = function(){
			var entity = this.entity;
			if(this.entity=="char"){
				entity = Sburb.char;
			}
			return entity.animation.hasPlayed();
		};
	}else if(this.type=="movie"){
		this.movie = window.document.getElementById("movie"+params[1]);
		this.threshold = parseInt(params[2]);
		this.checkCompletion = function(){
			if(this.movie && this.movie.TotalFrames()>0 && this.movie.TotalFrames()-1-this.movie.CurrentFrame()<=this.threshold){
				Sburb.commands.removeMovie(params[1]);
				return true;
			}
			return false;
		}
	}
}

//check if the trigger has been satisfied
Sburb.Trigger.prototype.tryToTrigger = function(){
	if(this.checkCompletion()){
		if(this.action){
			Sburb.performAction(this.action);
		}
		if(this.followUp){
			if(this.followUp.tryToTrigger()){
				this.followUp = null;
			}
		}
		if(this.restart){
			reset();
		}
		return this.detonate;
	}
}

//Serialize the Trigger to XML
Sburb.Trigger.prototype.serialize = function(output){
	output = output.concat("\n<Trigger"+
		(this.restart?" restart='true'":"")+
		(this.detonate?" detonate='true'":"")+
		">");
	output = output.concat(this.info);
	if(this.action){
		output = this.action.serialize(output);
	}
	if(this.followUp){
		output = this.followUp.serialize(output);
	}
	output = output.concat("\n</Trigger>");
	return output;
}







////////////////////////////////////////on
//Related Utility Functions
////////////////////////////////////////

//Parse a Trigger from XML
Sburb.parseTrigger = function(triggerNode){
	var firstTrigger = null;
	var oldTrigger = null;
	do{
		var attributes = triggerNode.attributes;
		var info = triggerNode.firstChild.nodeValue.trim();
		var actions = triggerNode.getElementsByTagName("Action");
		
		var action = null;
		var restart = false;
		var detonate = false;
		
		action = actions.length>0?Sburb.parseAction(actions[0]):action;
		restart = attributes.getNamedItem("restart")?attributes.getNamedItem("restart").value=="true":restart;
		detonate = attributes.getNamedItem("detonate")?attributes.getNamedItem("detonate").value=="true":detonate;
		
		var trigger = new Sburb.Trigger(info,action,null,restart,detonate);
		
		if(!firstTrigger){
			firstTrigger = trigger;
		}
		if(oldTrigger){
			oldTrigger.followUp = trigger;
		}
		oldTrigger = trigger;
		var triggerNodes = triggerNode.getElementsByTagName("Trigger");
		if(triggerNodes){
			triggerNode = triggerNodes[0];
		}else{
			break;
		}
	}while(triggerNode)
	return firstTrigger;
}

return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




//Create a Dialog
//syntax: dialog syntax
var talkCommand = function(info){
	Sburb.dialoger.startDialog(info);
}

//Change the room and move the character to a new location in that room
//syntax: roomName, newCharacterX, newCharacterY
var changeRoomCommand = function(info){
	var params = info.split(",");
	Sburb.changeRoom(Sburb.rooms[params[0]],parseInt(params[1]),parseInt(params[2]));
}

//Perform changeRoomCommand, and also add teleport effects
//syntax: see changeRoomCommand
var teleportCommand = function(info){
	changeRoomCommand(info);
	Sburb.playEffect(Sburb.effects["teleportEffect"],Sburb.char.x,Sburb.char.y);
	var params = info.split(",");
	Sburb.curAction.followUp = new Sburb.Action("playEffect","teleportEffect,"+params[1]+","+params[2],null,null,Sburb.curAction.followUp);
	//playSound(new BGM(assets["teleportSound"],0));
}

//Set a different Character as the player
//syntax: newPlayerName
var changeCharCommand = function(info){
	Sburb.char.becomeNPC();
	Sburb.char.walk();
	Sburb.focus = Sburb.char = Sburb.sprites[info];
	Sburb.char.becomePlayer();
	Sburb.setCurRoomOf(Sburb.char);
}

//Set the given song as the new background music
//syntax: songName, loopingStartPoint (seconds)
var playSongCommand = function(info){
	var params = info.split(",");
	params = params.map(function(s) { return s.trim(); });
	Sburb.changeBGM(new Sburb.BGM(Sburb.assets[params[0]],parseFloat(params[1])));
}

//Play the given sound
//syntax: soundName
var playSoundCommand = function(info){
	Sburb.playSound(new Sburb.Sound(Sburb.assets[info.trim()]));
}

//Play the given effect and the given location
//syntax: effectName, x, y
var playEffectCommand = function(info){
	var params = info.split(",");
	Sburb.playEffect(Sburb.effects[params[0]],parseInt(params[1]),parseInt(params[2]));
}

//Have the specified sprite play the specified animation
//syntax: spriteName, animationName
var playAnimationCommand = function(info){
	var params = info.split(",");
	var sprite;
	if(params[0]=="char"){
		sprite = Sburb.char;
	}else{
		sprite = Sburb.sprites[params[0]];
	}
	sprite.startAnimation(params[1]);
}

//Open the specified chest, revealing the specified item, and with the specified text
//Syntax: chestName, itemName, message
var openChestCommand = function(info){
	var params = info.split(",");
	var chest = Sburb.sprites[params[0]];
	var item = Sburb.sprites[params[1]];
	chest.startAnimation("open");
	chest.removeAction(Sburb.curAction.name);
	var lastAction;
	var newAction = lastAction = new Sburb.Action("waitFor","played,"+chest.name,null,null);
	lastAction = lastAction.followUp = new Sburb.Action("waitFor","time,13");
	lastAction = lastAction.followUp = new Sburb.Action("addSprite",item.name+","+Sburb.curRoom.name,null,null,null,true);
	lastAction = lastAction.followUp = new Sburb.Action("moveSprite",item.name+","+chest.x+","+(chest.y-60),null,null,null,true,true);
	lastAction = lastAction.followUp = new Sburb.Action("deltaSprite",item.name+",0,-3",null,null,null,true,null,10);
	lastAction = lastAction.followUp = new Sburb.Action("talk","@! "+params[2],null,null,null,true);
	lastAction = lastAction.followUp = new Sburb.Action("removeSprite",item.name+","+Sburb.curRoom.name);
	lastAction.followUp = Sburb.curAction.followUp;
	Sburb.performAction(newAction);
}

//Move the specified sprite by the specified amount
//syntax: spriteName, dx, dy
var deltaSpriteCommand = function(info){
	var params = info.split(",");
	var sprite = null;
	if(params[0]=="char"){
		sprite = Sburb.char;
	}else{
		sprite = Sburb.sprites[params[0]];
	}
	var dx = parseInt(params[1]);
	var dy = parseInt(params[2]);
	sprite.x+=dx;
	sprite.y+=dy;
}

//Move the specified sprite to the specified location
//syntax: spriteName, x, y
var moveSpriteCommand = function(info){
	var params = info.split(",");
	var sprite = null;
	if(params[0]=="char"){
		sprite = Sburb.char;
	}else{
		sprite = Sburb.sprites[params[0]];
	}
	var newX = parseInt(params[1]);
	var newY = parseInt(params[2]);
	sprite.x = newX;
	sprite.y = newY;
}

//Play the specified flash movie
//syntax: movieName
var playMovieCommand = function(info){
	Sburb.playMovie(Sburb.assets[info]);
	Sburb.bgm.pause();
}

//Remove the specified flash movie
//syntax: movieName
var removeMovieCommand = function(info){
	document.getElementById(info).style.display = "none";
	document.getElementById("gameDiv").style.display = "block";
	Sburb.bgm.play();
}

//Wait for the specified trigger to be satisfied
//syntax: Trigger syntax
var waitForCommand = function(info){
	Sburb.waitFor = new Sburb.Trigger(info);
}

//Add the specified sprite to the specified room
//syntax: spriteName, roomName
var addSpriteCommand = function(info){
	params = info.split(",");
	var sprite = Sburb.sprites[params[0]];
	var room = Sburb.rooms[params[1]];
	room.addSprite(sprite);
}

//Remove the specified sprite from the specified room
//syntax: spriteName, roomName
var removeSpriteCommand = function(info){
	params = info.split(",");
	var sprite = Sburb.sprites[params[0]];
	var room = Sburb.rooms[params[1]];
	room.removeSprite(sprite);
}

//Toggle the volume
//syntax: none
var toggleVolumeCommand = function(){
	if(Sburb.globalVolume>=1){
		Sburb.globalVolume=0;
	}else if(Sburb.globalVolume>=0.6){
		Sburb.globalVolume = 1;
	}else if(Sburb.globalVolume>=0.3){
		Sburb.globalVolume = 0.66;
	}else {
		Sburb.globalVolume = 0.33;
	}
	if(Sburb.bgm){
		Sburb.bgm.fixVolume();
	}
}

//change the engine mode
//syntax: modeName
var changeModeCommand = function(info){
	Sburb.engineMode = info.trim();
}

//blank utlity function
//syntax: none
var cancelCommand = function(){
	//do nothing
}

var commands = {};
commands.talk = talkCommand;
commands.changeRoom = changeRoomCommand;

commands.playAnimation = playAnimationCommand;
commands.playEffect = playEffectCommand;
commands.playSong = playSongCommand;
commands.playSound = playSoundCommand;
commands.playMovie = playMovieCommand;
commands.changeChar = changeCharCommand;
commands.teleport = teleportCommand;

commands.openChest = openChestCommand;
commands.waitFor = waitForCommand;

commands.addSprite = addSpriteCommand;
commands.removeSprite = removeSpriteCommand;
commands.deltaSprite = deltaSpriteCommand;
commands.moveSprite = moveSpriteCommand;

commands.changeMode = changeModeCommand;

commands.removeMovie = removeMovieCommand;
commands.toggleVolume = toggleVolumeCommand;
commands.cancel = cancelCommand;

Sburb.commands = commands;
return Sburb;

})(Sburb || {});
var Sburb = (function(Sburb){

var templateClasses = {};

Sburb.serialize = function(assets,effects,rooms,sprites,hud,dialoger,curRoom,char){
	var out = document.getElementById("serialText");
	var output = "<SBURB"+
		" curRoom='"+curRoom.name+
		"' char='"+char.name+
		(Sburb.bgm?"' bgm='"+Sburb.bgm.asset.name+(Sburb.bgm.startLoop?","+Sburb.bgm.startLoop:""):"")+
		(Sburb.Stage.scaleX!=1?"' scale='"+Sburb.Stage.scaleX:"")+
		"'>\n";
	output = serializeAssets(output,assets,effects);
	output = serializeTemplates(output,templateClasses);
	output = serializeHud(output,hud,dialoger);
	output = serializeLooseObjects(output,rooms,sprites);
	output = output.concat("\n<Rooms>\n");
	for(var room in rooms){
		output = rooms[room].serialize(output);
	}
	output = output.concat("\n</Rooms>\n");
	output = output.concat("\n</SBURB>");
	out.value = output;
	return output;
}

function serializeLooseObjects(output,rooms,sprites){
	for(var sprite in sprites){
		var theSprite = sprites[sprite];
		var contained = false;
		for(var room in rooms){
			if(rooms[room].contains(theSprite)){
				contained = true;
				break;
			}
		}
		if(!contained){
			output = theSprite.serialize(output);
		}
	}
	return output;
}

function serializeAssets(output,assets,effects){
	output = output.concat("\n<Assets>");
	for(var asset in assets){
		var curAsset = assets[asset];
		output = output.concat("\n<Asset name='"+curAsset.name+"' type='"+curAsset.type+"'>");
		if(curAsset.type=="graphic"){
			output = output.concat(curAsset.src.substring(curAsset.src.indexOf("resources/"),curAsset.src.length));
		}else if(curAsset.type=="audio"){
			var sources = curAsset.innerHTML.split('"');
			var s1 = sources[1];
			var s2 = sources[3];
			output = output.concat(s1+";"+s2);

		}else if(curAsset.type=="path"){
			for(var i=0;i<curAsset.points.length;i++){
				output = output.concat(curAsset.points[i].x+","+curAsset.points[i].y);
				if(i!=curAsset.points.length-1){
					output = output.concat(";");
				}
			}
		}else if(curAsset.type=="movie"){
			output = output.concat(curAsset.src);
		}
		output = output.concat("</Asset>");
	}
	output = output.concat("\n</Assets>\n");
	output = output.concat("\n<Effects>");
	for(var effect in effects){
		var curEffect = effects[effect];
		output = curEffect.serialize(output);
	}
	output = output.concat("\n</Effects>\n");
	return output;
}

function serializeTemplates(output,templates){
	output = output.concat("\n<Classes>");
	var serialized;
	try {
		// XMLSerializer exists in current Mozilla browsers
		serializer = new XMLSerializer();
		for(var template in templates){
			output = output.concat(serializer.serializeToString(templates[template]));
		}
	}catch (e) {
		// Internet Explorer has a different approach to serializing XML
		for(var template in templates){
			output = output.concat(templates[template].xml);
		}
	}
	output = output.concat("\n</Classes>\n");
	return output;
}

function serializeHud(output,hud,dialoger){
	output = output.concat("\n<HUD>");
	for(var content in hud){
		output = hud[content].serialize(output);
	}
	var animations = dialoger.dialogSpriteLeft.animations;
	output = output.concat("\n<DialogSprites>");
	for(var animation in animations){
		output = animations[animation].serialize(output);
	}
	output = output.concat("\n</DialogSprites>");
	output = output.concat("\n</HUD>\n");
	return output;
}

function purgeAssets() {
    Sburb.assetManager.purge();
    Sburb.assets = Sburb.assetManager.assets;
}
function purgeState(){
	if(Sburb.updateLoop){
		clearTimeout(Sburb.updateLoop);
	}
	if(Sburb.rooms){
		delete Sburb.rooms;
	}
	if(Sburb.sprites){
		delete Sburb.sprites;
	}
	Sburb.rooms = {};
	if(Sburb.bgm){
		Sburb.bgm.stop();
		Sburb.bgm = null;
	}
	document.getElementById("movieBin").innerHTML = "";
	Sburb.globalVolume = 1;
	Sburb.hud = {};
	Sburb.sprites = {};
	Sburb.effects = {};
	Sburb.curAction = null;
	Sburb.pressed = [];
	Sburb.chooser = new Sburb.Chooser();
	Sburb.dialoger = new Sburb.Dialoger();
	Sburb.curRoom = null;
}
Sburb.loadSerialFromXML = function(file, savedStateID) {
    if(window.ActiveXObject) {
			var request = new ActiveXObject("MSXML2.XMLHTTP");
    } else {
			var request = new XMLHttpRequest();
    }
    request.open('GET', file, false);
    try {
			request.send(null);
    } catch(err) {
			console.log("If you are running Google Chrome, you need to run it with the -allow-file-access-from-files switch to load this.");
			fi = document.getElementById("levelFile");
			return;
    }
    if (request.status === 200 || request.status == 0) {  
			loadSerial(request.responseText, savedStateID);
    }
}
function loadLevelFile(node) {
    if (!window.FileReader) {
		alert("This browser doesn't support reading files");
    }
    oFReader = new FileReader();
    if (node.files.length === 0) { return; }  
    var oFile = node.files[0];
    oFReader.onload = function() { loadSerial(this.result); };
    oFReader.onerror = function(e) {console.log(e); }; // this should pop up an alert if googlechrome
    oFReader.readAsText(oFile);
}

function loadSerial(serialText, sburbID) {
    var inText = serialText; //document.getElementById("serialText");
    var parser=new DOMParser();
    var input=parser.parseFromString(inText,"text/xml");

    if(sburbID) {
			input = input.getElementById(sburbID);
    } else {
  		input = input.documentElement;
    }
    // should we assume that all assets with the same name
    // have the same data? if so we don't need this next line
    purgeAssets(); 

    purgeState();
    var newAssets = input.getElementsByTagName("Asset");
    for(var i=0;i<newAssets.length;i++){
			var curAsset = newAssets[i];
	  		var attributes = curAsset.attributes;
			var name = attributes.getNamedItem("name").value;
			if (!Sburb.assetManager.isLoaded(name)) {
				loadSerialAsset(curAsset);
			}
    }

    setTimeout(function() { loadSerialState(input) }, 500);
}

function loadSerialAsset(curAsset){
    var newAsset = parseSerialAsset(curAsset);
    Sburb.assetManager.loadAsset(newAsset);
}

function parseSerialAsset(curAsset) {
	var attributes = curAsset.attributes;
	var name = attributes.getNamedItem("name").value;
	var type = attributes.getNamedItem("type").value;
	var value = curAsset.firstChild.nodeValue;

	var newAsset;
	if(type=="graphic"){
		newAsset = Sburb.createGraphicAsset(name,value);
	} else if(type=="audio"){
		var sources = value.split(";");
		newAsset = Sburb.createAudioAsset(name,sources[0],sources[1]);
	} else if(type=="path"){
		var pts = value.split(";");
		var path = new Sburb.Path();
		for(var j=0;j<pts.length;j++){
			 var point = pts[j].split(",");
			 path.push({x:parseInt(point[0]),y:parseInt(point[1])});
		}
		newAsset = Sburb.createPathAsset(name,path);
	}else if(type=="movie"){
		newAsset = Sburb.createMovieAsset(name,value);
	}
	return newAsset;
}

function loadSerialState(input) {
    // this is more or less this init function for a game
    if(!Sburb.assetManager.finishedLoading()) {
		updateLoop=setTimeout(function() { loadSerialState(input); } ,500);
		return;
    }
    
    var templates = input.getElementsByTagName("Classes")[0].childNodes;
    for(var i=0;i<templates.length;i++){
    	var templateNode = templates[i];
    	if(templateNode.nodeName!="#text"){
		 	var tempAttributes = templateNode.attributes;
		 	var tempChildren = templateNode.childNodes;
		 	var candidates = input.getElementsByTagName(templateNode.nodeName);
		 	for(var j=0;j<candidates.length;j++){
		 		var candidate = candidates[j];
		 		var candAttributes = candidate.attributes;
		 		var candClass = candidate.attributes.getNamedItem("class");
		 		var candChildren = candidate.childNodes;
		 		if(candClass && candidate!=templateNode && candClass.value==tempAttributes.getNamedItem("class").value){
		 			for(var k=0;k<tempAttributes.length;k++){
		 				var tempAttribute = tempAttributes[k];
		 				if(!candAttributes.getNamedItem(tempAttribute.name)){
		 					candidate.setAttribute(tempAttribute.name,tempAttribute.value);
		 				}
		 			}
		 			for(var k=0;k<tempChildren.length;k++){
		 				candidate.appendChild(tempChildren[k].cloneNode(true));
		 			}
		 		}
		 	}
		 	templateClasses[tempAttributes.getNamedItem("class").value] = templateNode.cloneNode(true);
    	}
    }
    input.removeChild(input.getElementsByTagName("Classes")[0]);
	
	var newButtons = input.getElementsByTagName("SpriteButton");
	for(var i=0;i<newButtons.length;i++){
		var curButton = newButtons[i];
		var newButton = Sburb.parseSpriteButton(curButton);
  		Sburb.hud[newButton.name] = newButton;
	}
  	
  	var newSprites = input.getElementsByTagName("Sprite");
  	for(var i=0;i<newSprites.length;i++){
  		var curSprite = newSprites[i];
		var newSprite = Sburb.parseSprite(curSprite, Sburb.assets);
  		Sburb.sprites[newSprite.name] = newSprite;
  	}
  	var newChars = input.getElementsByTagName("Character");
  	for(var i=0;i<newChars.length;i++){
  		var curChar = newChars[i];
		var newChar = Sburb.parseCharacter(curChar, Sburb.assets);
  		Sburb.sprites[newChar.name] = newChar;
  	}
  	var newFighters = input.getElementsByTagName("Fighter");
  	for(var i=0;i<newFighters.length;i++){
  		var curFighter = newFighters[i];
		var newFighter = Sburb.parseFighter(curFighter, Sburb.assets);
  		Sburb.sprites[newFighter.name] = newFighter;
  	}
  	var newRooms = input.getElementsByTagName("Room");
  	for(var i=0;i<newRooms.length;i++){
  		var currRoom = newRooms[i];
		var newRoom = Sburb.parseRoom(currRoom, Sburb.assets, Sburb.sprites);
  		Sburb.rooms[newRoom.name] = newRoom;
  	}
  	var rootInfo = input.attributes;
  	
  	Sburb.focus = Sburb.char = Sburb.sprites[rootInfo.getNamedItem("char").value];
  	Sburb.char.becomePlayer();
  	
  	var mode = rootInfo.getNamedItem("mode");
  	if(mode){
  		Sburb.engineMode = mode.value;
  	}else{
  		Sburb.engineMode = "wander";
  	}
  	
  	var scale = rootInfo.getNamedItem("scale");
  	if(scale){
  		Sburb.Stage.scaleX = Sburb.Stage.scaleY = parseInt(scale.value);
  	}else{
  		Sburb.Stage.scaleX = Sburb.Stage.scaleY = 1;
  	}
  	
  	Sburb.curRoom = Sburb.rooms[rootInfo.getNamedItem("curRoom").value];
  	
  	if(rootInfo.getNamedItem("bgm")){
  		var params = rootInfo.getNamedItem("bgm").value.split(",");
  		Sburb.changeBGM(new Sburb.BGM(Sburb.assets[params[0]],parseFloat(params.length>1?params[1]:"0")));
  	}
  	
  	var dialogBox = new Sburb.Sprite("dialogBox",Stage.width+1,1000,Sburb.assets.dialogBox.width,Sburb.assets.dialogBox.height, null,null,0);
  	dialogBox.addAnimation(new Sburb.Animation("image",Sburb.assets.dialogBox,0,0,Sburb.assets.dialogBox.width,Sburb.assets.dialogBox.height,0,1,1));
	dialogBox.startAnimation("image");
  	Sburb.dialoger.setBox(dialogBox);
  	
	
  	serialLoadDialogSprites(input.getElementsByTagName("HUD")[0].getElementsByTagName("DialogSprites")[0],Sburb.assets);
  	
  	serialLoadEffects(input.getElementsByTagName("Effects")[0],Sburb.assets,Sburb.effects);
  	
    var initAction;
    var initActionName;
    if(rootInfo.getNamedItem("startAction")){
    	initActionName = rootInfo.getNamedItem("startAction").value;
    }else{
    	initActionName = "none";
    }
    for(var i=0; i<input.childNodes.length; i++) {
			var tmp = input.childNodes[i];
			if(tmp.tagName=="Action" && tmp.attributes.getNamedItem("name").value == initActionName) {
				initAction = Sburb.parseAction(tmp);
				continue;
			}
    }
    if(initAction) {
			Sburb.performAction(initAction);
    }

    Sburb.update();
}

function serialLoadDialogSprites(dialogSprites,assetFolder){
	Sburb.dialoger.dialogSpriteLeft = new Sburb.Sprite("dialogSprite",-1000,Stage.height,0,0);
	Sburb.dialoger.dialogSpriteRight = new Sburb.Sprite("dialogSprite",Stage.width+1000,Stage.height,0,0);
	var animations = dialogSprites.getElementsByTagName("Animation");
	for(var i=0;i<animations.length;i++){
		Sburb.dialoger.dialogSpriteLeft.addAnimation(Sburb.parseAnimation(animations[i],assetFolder));
		Sburb.dialoger.dialogSpriteRight.addAnimation(Sburb.parseAnimation(animations[i],assetFolder));
	}
}

function serialLoadEffects(effects,assetFolder,effectsFolder){
	var animations = effects.getElementsByTagName("Animation");
	for(var i=0;i<animations.length;i++){
		var newEffect = Sburb.parseAnimation(animations[i],assetFolder);
		effectsFolder[newEffect.name] = newEffect;
	}
}

function serialLoadRoomSprites(newRoom, roomSprites, spriteFolder){
	for(var j=0;j<roomSprites.length;j++){
		var curSprite = roomSprites[j];
		var actualSprite = spriteFolder[curSprite.attributes.getNamedItem("name").value];
		newRoom.addSprite(actualSprite);
	  	var newActions = curSprite.childNodes;
		for(var k=0;k<newActions.length;k++){
			if(newActions[k].nodeName == "#text") {
				continue;
			}
			if(newActions[k].nodeName == "Action"){
				var newAction = Sburb.parseAction(newActions[k]);
				actualSprite.addAction(newAction);
			}
		}
	}
}

function serialLoadRoomPaths(newRoom, paths, assetFolder) {
	var walkables = paths[0].getElementsByTagName("Walkable");
	for(var j=0;j<walkables.length;j++){
		var node = walkables[j];
		var attributes = node.attributes;
		newRoom.addWalkable(assetFolder[attributes.getNamedItem("path").value]);
	}
	
	var unwalkables = paths[0].getElementsByTagName("Unwalkable");
	for(var j=0;j<unwalkables.length;j++){
		var node = unwalkables[j];
		var attributes = node.attributes;
		newRoom.addUnWalkable(assetFolder[attributes.getNamedItem("path").value]);
	}
	
	var motionPaths = paths[0].getElementsByTagName("MotionPath");
	for(var j=0;j<motionPaths.length;j++) {
		var node = motionPaths[j];
		var attributes = node.attributes;
		newRoom.addMotionPath(assetFolder[attributes.getNamedItem("path").value], 
				      parseFloat(attributes.getNamedItem("xtox").value), 
				      parseFloat(attributes.getNamedItem("xtoy").value), 
				      parseFloat(attributes.getNamedItem("ytox").value), 
				      parseFloat(attributes.getNamedItem("ytoy").value), 
				      parseFloat(attributes.getNamedItem("dx").value), 
				      parseFloat(attributes.getNamedItem("dy").value));
	}
}

function serialLoadRoomTriggers(newRoom, triggers){
 	var candidates = triggers[0].childNodes;
	for(var i=0;i<candidates.length;i++){
		if(candidates[i].nodeName=="Trigger"){
			newRoom.addTrigger(Sburb.parseTrigger(candidates[i]));
		}
	}
}

Sburb.serializeAttribute = function(base,val){
	var sub;
	return base[val]?" "+val+"='"+base[val]+"' ":"";
}

Sburb.serializeAttributes = function(base){
	str = "";
	for(var i=1;i<arguments.length;i++){
		str = str.concat(Sburb.serializeAttribute(base,arguments[i]));
	}
	return str;
}

Sburb.serialLoadRoomSprites = serialLoadRoomSprites;
Sburb.serialLoadRoomPaths = serialLoadRoomPaths;
Sburb.serialLoadRoomTriggers = serialLoadRoomTriggers;
Sburb.loadSerial = loadSerial;


return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){





///////////////////////////////////
//Dialoger Class
///////////////////////////////////

//Constructor
Sburb.Dialoger = function(){
	this.talking = false;
	this.queue = [];
	this.dialog = new Sburb.FontEngine();
	this.colorMap = {CG:"#000000"};
	this.dialogSpriteLeft = null;
	this.dialogSpriteRight = null;
	this.box = null;
	this.alertPos = {x:56, y:140}
	this.talkPosRight = {x:0, y:140}
	this.talkPosLeft = {x:112, y:140}
	this.hiddenPos = {x:-1000, y:140}
	this.dialogLeftStart = -300;
	this.dialogLeftEnd = 100;
	this.dialogRightStart = Sburb.Stage.width+300;
	this.dialogRightEnd = Sburb.Stage.width-100;
	this.actor = null;
	this.dialogSide = "Left";
	this.graphic = null;
}

//nudge the dialoger forward
Sburb.Dialoger.prototype.nudge = function(){
	if(this.dialog.isShowingAll()){
		if(this.dialog.nextBatch()){
			this.dialog.showSubText(0,0);
		}else{
			if(this.queue.length>0){
				this.nextDialog();
			}else{
				this.talking = false;
			}
		}
	}else{
		this.dialog.showAll();
	}
}

//start the provided dialog
Sburb.Dialoger.prototype.startDialog = function(info){
	this.actor = null;
	this.queue = info.split("@");
	this.queue.reverse();
	this.queue.pop();
	this.nextDialog();
	this.box.x=-this.box.width;
	this.talking = true;
}

//start the next dialog
Sburb.Dialoger.prototype.nextDialog = function(){
	var nextDialog = this.queue.pop();
	this.dialog.setText(nextDialog);
	this.dialog.showSubText(0,0);
	var prefix = nextDialog.substring(0,nextDialog.indexOf(" "));
	if(prefix.indexOf("~")>=0){
		var resource = prefix.substring(prefix.indexOf("~")+1,prefix.length);	
		prefix = prefix.substring(0,prefix.indexOf("~"));	
		var img = Sburb.assets[resource];
		this.graphic = new Sburb.Sprite();
		this.graphic.addAnimation(new Sburb.Animation("image",img,0,0,img.width,img.height,0,1,1));
		this.graphic.startAnimation("image");
	}else{
		this.graphic = null;
	}
	if(prefix=="!"){
		this.actor = null;
		this.dialogSide = "Left";
	}else{
		var newActor;
		if(prefix.indexOf("_")>=0){
			newActor = prefix.substring(0,prefix.indexOf("_"));	
		}else{
			newActor = prefix.substring(0,2);
		}
		if(this.actor==null){
			this.dialogSide = "Left";
			this.dialogOnSide(this.dialogSide).x = this.startOnSide(this.oppositeSide(this.dialogSide));
		}else if(this.actor!=newActor){
			this.dialogSide = this.oppositeSide(this.dialogSide);
			this.dialogOnSide(this.dialogSide).x = this.startOnSide(this.dialogSide);
		}
		this.actor = newActor;
		this.dialogOnSide(this.dialogSide).startAnimation(prefix);
	}
	
}

//get the string suffix for the opposite side to that is currently talking
Sburb.Dialoger.prototype.oppositeSide = function(side){
	if(side=="Left"){
		return "Right";
	}else{
		return "Left";
	}
}

//get the dialogSprite on the specified side
Sburb.Dialoger.prototype.dialogOnSide = function(side){
	return this["dialogSprite"+side];
}

//get the start position of a dialog on the specified side
Sburb.Dialoger.prototype.startOnSide = function(side){
	return this["dialog"+side+"Start"];
}

//get the end position of a dialog on the specified side
Sburb.Dialoger.prototype.endOnSide = function(side){
	return this["dialog"+side+"End"];
}

//move the specified sprite towards the specified location at the specified speed
Sburb.Dialoger.prototype.moveToward = function(sprite,pos,speed){
	if(typeof speed != "number"){
		speed = 100;
	}
	if(Math.abs(sprite.x-pos)>speed){
		sprite.x+=speed*Math.abs(pos-sprite.x)/(pos-sprite.x);
		return false;
	}else{
		sprite.x = pos;
		return true;
	}
}

//update the Dialoger one frame
Sburb.Dialoger.prototype.update = function(){
	if(this.talking){
		var desiredPos;
		var ready = true;
		if(this.actor==null){
			desiredPos = this.alertPos;
		}else{
			desiredPos = this["talkPos"+this.dialogSide];	
			ready = this.moveToward(this.dialogOnSide(this.dialogSide),this.endOnSide(this.dialogSide));
			this.moveToward(this.dialogOnSide(this.oppositeSide(this.dialogSide)),this.startOnSide(this.oppositeSide(this.dialogSide)));
		}
		this.box.y = desiredPos.y;	
		if(this.moveToward(this.box,desiredPos.x,110) && ready){
			if(this.dialog.start==this.dialog.end){
				var dialogDimensions = this.decideDialogDimensions();
				this.dialog.setDimensions(dialogDimensions.x,dialogDimensions.y,dialogDimensions.width,dialogDimensions.height);
			}
			this.dialog.showSubText(null,this.dialog.end+2);
			if(this.actor){
				this.dialogOnSide(this.dialogSide).update(1);
			}
		}
		if(this.graphic){
			this.graphic.x = this.box.x;
			this.graphic.y = this.box.y;
		}
	}else {
		if(this.box.x>this.hiddenPos.x){
			this.box.x-=120;
		}
		if(this.actor!=null){
			if(this.moveToward(this.dialogOnSide(this.dialogSide),this.startOnSide(this.oppositeSide(this.dialogSide)))){
				this.actor = null;
			}
		}
	}
}

//get what the dimensions of the dialog should be
Sburb.Dialoger.prototype.decideDialogDimensions = function(){
	if(this.actor==null){
		return {x:this.box.x+30,
				y:this.box.y+30,
				width:this.box.width-80,
				height:this.box.height-50}
	}else if(this.dialogSide=="Left"){
		return {x:this.box.x+150,
				y:this.box.y+30,
				width:this.box.width-180,
				height:this.box.height-50}
	}else{
		return {x:this.box.x+30,
				y:this.box.y+30,
				width:this.box.width-180,
				height:this.box.height-50}
	}
}

//set the dialog box graphic
Sburb.Dialoger.prototype.setBox = function(box,x,y){
	this.box = box;
	this.hiddenPos = {x: (typeof x == "number" ? x:-box.width), y: (typeof y == "number" ? y:this.hiddenPos.y)};
}

//draw the dialog box
Sburb.Dialoger.prototype.draw = function(){
	this.box.draw();
	if(this.graphic){
		this.graphic.draw();
	}
	if(this.talking){
		this.dialog.draw();
	}
	if(this.actor!=null){
		this.dialogSpriteLeft.draw();
		if(this.dialogSpriteRight.animation){
			this.dialogSpriteRight.animation.flipX=true;
		}
		this.dialogSpriteRight.draw();
	}
}

//draw meta info of the dialog box
Sburb.Dialoger.prototype.drawMeta = function(){
	var box = this.decideDialogDimensions();
	Sburb.stage.save();
	Sburb.stage.strokeStyle = "rgb(200,50,50)";
	Sburb.stage.beginPath();
	Sburb.stage.moveTo(box.x,box.y);
	Sburb.stage.lineTo(box.x+box.width,box.y);
	Sburb.stage.lineTo(box.x+box.width,box.y+box.height);
	Sburb.stage.lineTo(box.x,box.y+box.height);
	Sburb.stage.lineTo(box.x,box.y);
	Sburb.stage.closePath();
	Sburb.stage.stroke();
	Sburb.stage.restore();
}


return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){




///////////////////////////////////////
//Chooser Class
///////////////////////////////////////

//constructor
Sburb.Chooser = function(){
	this.choosing = false;
	this.choices = [];
	this.choice = 0;
	this.dialogs = [];
}

//go to the next choice
Sburb.Chooser.prototype.nextChoice = function(){
	this.choice = (this.choice+1)%this.choices.length;
}

//go to the previous choice
Sburb.Chooser.prototype.prevChoice = function(){
	this.choice = (this.choice-1+this.choices.length)%this.choices.length;
}

//initialize chooser
Sburb.Chooser.prototype.beginChoosing = function(x,y){
	this.choosing = true;
	this.choice = 0;
	this.dialogs = [];
	for(var i=0;i<this.choices.length;i++){
		var curEngine = new Sburb.FontEngine(" > "+this.choices[i].name);
		curEngine.showSubText(0,1);
		curEngine.setDimensions(x,y+i*curEngine.lineHeight);
		this.dialogs.push(curEngine);
	}
}

//draw the chooser
Sburb.Chooser.prototype.draw = function(){
	if(this.choosing){
		Sburb.stage.save();
		var x,y,width=160,height=0,i;
		x = this.dialogs[0].x;
		y = this.dialogs[0].y-1;
		for(i=0;i<this.dialogs.length;i++){
			width = Math.max(width,this.dialogs[i].lines[0].length*this.dialogs[i].charWidth);
		}
		height = this.dialogs[0].lineHeight*this.dialogs.length;
		Sburb.stage.fillStyle = "#ff9900";
		Sburb.stage.fillRect(x-6,y-6,width+12,height+13);
		Sburb.stage.fillStyle = "#ffff00";
		Sburb.stage.fillRect(x-2,y-2,width+4,height+5);
		Sburb.stage.fillStyle = "#000000";
		Sburb.stage.fillRect(x,y,width,height);
		for(i=0;i<this.dialogs.length;i++){
			this.dialogs[i].draw();
		}
		Sburb.stage.restore();
	}
}

//update the chooser one frame
Sburb.Chooser.prototype.update = function(gameTime){
	if(this.choosing){
		for(var i=0;i<this.dialogs.length;i++){
			var curDialog = this.dialogs[i];
			curDialog.showSubText(null,curDialog.end+1);
			if(i==this.choice){
				if(gameTime%Sburb.Stage.fps<Sburb.Stage.fps/2){
					curDialog.start = 2;
				}else{
					curDialog.start = 0;
				}
				curDialog.color = "#cccccc";	
			}else{
				curDialog.start = 0;
				curDialog.color = "#ffffff";
			}
		}
	}
}



return Sburb;
})(Sburb || {});
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
	this.asset.currentTime = this.startLoop;
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
var Sburb = (function(Sburb){




////////////////////////////////////////////
//AssetManager Class
////////////////////////////////////////////

//Constructor
Sburb.AssetManager = function() {
	this.totalAssets = 0;
	this.totalLoaded = 0;
	this.assets = {};
	this.loaded = {};
	this.recurrences = {};
}

//get the remaining assets to be loaded
Sburb.AssetManager.prototype.totalAssetsRemaining = function() {
	return this.totalAssets - this.totalLoaded;
}

//have all the assets been loaded
Sburb.AssetManager.prototype.finishedLoading = function() {
	return (this.totalAssets && (this.totalAssets == this.totalLoaded));
}

//check if a specific asset has been loaded
Sburb.AssetManager.prototype.isLoaded = function(name) {
	// turn undefined into false
	return this.loaded[name] ? true : false;
}

//reset the asset manager to have no assets
Sburb.AssetManager.prototype.purge = function() {
	this.assets = {}
	this.loaded = {}
	this.totalLoaded = 0;
	this.totalAssets = 0;
}

//load the given asset
Sburb.AssetManager.prototype.loadAsset = function(assetObj) {
	var name = assetObj.name;
	this.assets[name] = assetObj;
	if(assetObj.instant) {
		return;
	}

	var oThis = this;
	this.assetAdded(name);	
	var loadedAsset = this.assets[name].assetOnLoadFunction(function() { oThis.assetLoaded(name); });
	if(!loadedAsset && assetObj.needsTimeout && assetObj.checkLoaded){
		this.recurrences[assetObj.name] = assetObj.checkLoaded;
	}
}

//log that the asset was added
Sburb.AssetManager.prototype.assetAdded = function(name) {
	this.totalAssets++;
	this.loaded[name] = false;
}

//log that the asset was loaded
Sburb.AssetManager.prototype.assetLoaded = function(name){
	//console.log(name,this.loaded);
	if(this.assets[name]){
		if(!this.loaded[name]){
			this.loaded[name] = true
			this.totalLoaded++;
			
			// Jterniabound.js
			Sburb.drawLoader();
			
			if(this.finishedLoading() && Sburb._hardcode_load){
				// only really here to work for old hard-loading
				Sburb.finishInit();
				initFinished = true;
				
			}
		}
	}
};






////////////////////////////////////////////
//Related Utility functions
////////////////////////////////////////////

//Create a graphic Asset
Sburb.createGraphicAsset = function(name, path) {
    var ret = new Image();
    ret.loaded = false;
    ret.onload = function() {
		ret.loaded = true;
    }
    ret.src = path;
    ret.type = "graphic";
    ret.name = name;
    ret.assetOnLoadFunction = function(fn) {
		if(ret.loaded) {
			if(fn) { fn(); }
			return true;
		} else {
			ret.onload = function () {
				ret.loaded = true
				if(fn) { fn(); }
			}
			return false;
		}
    };
    return ret;
}

//create an audio Asset
Sburb.createAudioAsset = function(name) {
    var ret = new Audio();
    ret.name = name
    ret.type = "audio";
    ret.preload = true;
    //ret.needsTimeout = true;
    for (a=1; a < arguments.length; a++) {
		var tmp = document.createElement("source")
		tmp.src = arguments[a];
		ret.appendChild(tmp);
    }
    ret.assetOnLoadFunction = function(fn) {
		this.checkLoaded = function(){
			//console.log("check!",ret.name);
			if (ret.readyState==4) {
				//console.log("good!");
				if(fn) { fn(); }
				return true;
			}
			return false;
		}
		if(!this.checkLoaded()){
			ret.addEventListener('loadeddata', fn);
			return false;
		}else{
			return true;
		}
    };
    return ret;
}

//create a flash movie Asset
Sburb.createMovieAsset = function(name,path){
	var ret = {src:path};
	document.getElementById("movieBin").innerHTML += '<div id="'+name+'"><object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" codebase="http://fpdownload.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,0,0" id="movie" width="550" height="400"><param name="allowScriptAccess" value="always" /\><param name="movie" value="'+name+'" /\><param name="quality" value="high" /\><param name="bgcolor" value="#ffffff" /\><embed src="'+path+'" quality="high" bgcolor="#ffffff" width="550" height="400" swLiveConnect=true id="movie'+name+'" name="movie'+name+'" allowScriptAccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer" /\></object></div>';
	
	
	ret.name = name;
	ret.type = "movie";
	ret.instant = true;
	
	document.getElementById(name).style.display = "none";

	return ret;
	
}

//create a path asset
Sburb.createPathAsset = function(name, path) {
    var ret = path;
    ret.name = name;
    ret.type = "path";
    ret.instant = true;
    ret.assetOnLoadFunction = function(fn) {
		if(fn) { fn(); }
		return;
    }
    return ret
}

return Sburb;
})(Sburb || {});
var Sburb = (function(Sburb){


/////////////////////////////////////
//Path class
/////////////////////////////////////

//constructor
Sburb.Path = function(){
	this.points = [];
}

//add a point to the path
Sburb.Path.prototype.push = function(point){
	this.points.push(point);
}

//Check if the given points are in the path, favouring positively
Sburb.Path.prototype.queryBatchPos = function(queries,results){
	for(var query in queries){
		results[query] = results[query] || this.query(queries[query]);
	}
}

//Check if the given points are in the path, favouring negatively
Sburb.Path.prototype.queryBatchNeg = function(queries,results){
	for(var query in queries){
		results[query] = results[query] && this.query(queries[query]);
	}
}

//Check if the given point is in the path
Sburb.Path.prototype.query = function(pt){
	for(var c = false, i = -1, l = this.points.length, j = l - 1; ++i < l; j = i){
		var ptA = this.points[i];
		var ptB = this.points[j];
		((ptA.y <= pt.y && pt.y < ptB.y) || (ptB.y <= pt.y && pt.y < ptA.y))
		&& (pt.x < (ptB.x - ptA.x) * (pt.y - ptA.y) / (ptB.y - ptA.y) + ptA.x)
		&& (c = !c);
	}
	return c;
}






return Sburb;
})(Sburb || {});