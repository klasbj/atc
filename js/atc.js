
/*
 * let each pixel denote 1/50 nm
 */
function plane(_id,_x,_y,_alt,_dir,_speed) {
    this.id = _id;
    this.x = _x;
    this.y = _y;
    this.dir = _dir;
    this.speed = _speed;
    this.alt = _alt;

    /* dt is time difference in ms */
    this.updatepos = function(dt) {
        d = this.draw_dir();
        dlen = (this.speed/3600.)   // nm per second
            * (dt / 1000.)         // nm since last
            * 50.;                  // 1/10 nm since last
        this.x = this.x + dlen * Math.cos(d);
        this.y = this.y + dlen * Math.sin(d);
    }

    this.draw_dir = function() {
        return (this.dir + 270) * Math.PI / 180;
    }
}

function handleKeyUp(evt) {
    switch (evt.keyCode) {
        case 37:    // left
            planes[0].dir = (planes[0].dir + 350) % 360;
            break;
        case 39:    // right
            planes[0].dir = (planes[0].dir + 10) % 360;
            break;
        case 40:    // down
            planes[0].speed = Math.max(0,planes[0].speed-10);
            break;
        case 38:    // up
            planes[0].speed = Math.max(0,planes[0].speed+10);
            break;

        case 'n'.charCodeAt(0):
            p.dir = 0;
            break;
        default:
            break;
    }
}

window.addEventListener('keypress', handleKeyUp, true);

var planes = [];
var context;

function onload() {
    init();
    step();
}

function init() {
    planes.push(new plane('a', 50,50,10000,100,100));
    canvas = document.getElementById("game");
    context = canvas.getContext('2d');
}

function step() {
    for (i = 0; i < planes.length; i = i + 1) {
        planes[i].updatepos(1000);
    }

    for (i = 0; i < planes.length; i = i + 1) {
        drawplane(planes[i]);
    }
    setTimeout('step()',1000);
}

function drawplane(p) {
    context.fillStyle = "#000000";
    context.strokeStyle = "#00ff00";
    context.lineWidth = 1;
    context.lineCap="butt";
    context.fillRect(0,0,640,480);  // clear the canvas
    context.font="9px Arial";


    var dx = p.x-2.5, dy = p.y-2.5;
    var sticklen = 20;
    var radang=p.draw_dir();
    var lx1 = p.x + 5*Math.cos(radang),
        ly1 = p.y + 5*Math.sin(radang),
        lx2 = p.x + sticklen*Math.cos(radang),
        ly2 = p.y + sticklen*Math.sin(radang);

    context.strokeRect(dx,dy,5,5);
    context.beginPath();
    context.moveTo(lx1,ly1);
    context.lineTo(lx2,ly2);
    context.stroke();


    txt = p.speed + " =" + Math.round(p.alt / 100);

    mobj = context.measureText(txt).width;

    tw = context.measureText(txt).width;
    th = context.measureText(txt).height;

    tx = p.x - tw - 5;
    ty = p.y;


    context.fillStyle="#00ff00";
    context.fillText(p.id, tx, ty);
    context.fillText(txt, tx, ty+11);

}
