var eps = .0000001;

var STATE_NORMAL       = 0,
    STATE_ALERT        = 1,
    STATE_UNCONTOLLED  = 2;

var BG = "#000",
    PLANE_COLORS = ["#0f0","#f00","#00f"];

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
    this.target_alt = _alt;
    this.target_dir = _dir;
    this.target_speed = _speed;

    this.fpm = 3000;
    this.turnrate = 360/120;    // two minute turn
    this.acceleration = 5;  // knots / s

    this.state = STATE_NORMAL;

    /* dt is time difference in ss */
    this.updatepos = function(dt) {
        /* update the position of the plane */
        d = this.draw_dir();
        dlen = (this.speed/3600.)   // nm per second
            * dt                    // nm since last
            * 50.;                  // 1/10 nm since last
        this.x = this.x + dlen * Math.cos(d);
        this.y = this.y + dlen * Math.sin(d);

        /* update the plane's altitude */
        dalt = this.target_alt - this.alt;
        if (Math.abs(dalt) > eps) {
            sdalt = dalt / Math.abs(dalt);
            this.alt = this.alt + sdalt * Math.min(sdalt*dalt, (this.fpm/60.) * dt);
        }

        /* update the plane's direction */
        ddir = this.target_dir - this.dir;
        if (Math.abs(ddir) > eps) {
            sddir = ddir / Math.abs(ddir);
            if (Math.abs(ddir) > 180) {
                ddir = this.target_dir - sddir*360 - this.dir;
            }
            sddir = ddir / Math.abs(ddir);
            this.dir = this.dir + sddir * Math.min(sddir*ddir, this.turnrate * dt);
            this.dir = (this.dir + 360) % 360;
        }

        /* update the plane's speed */
        dspd = this.target_speed - this.speed;
        if (Math.abs(dspd) > eps) {
            sdspd = dspd / Math.abs(dspd);
            this.speed = this.speed + sdspd * Math.min(sdspd*dspd, this.acceleration * dt);
        }
    }

    this.draw_dir = function() {
        return (this.dir + 270) * Math.PI / 180;
    }

    this.alt_string = function() {
        str = "" + Math.round(this.target_alt/100);
        if (this.target_alt > this.alt) {
            str = str + "+";
        } else if (this.target_alt < this.alt) {
            str = str + "-";
        } else {
            str = str + "=";
        }
        str = str + Math.round(this.alt/100);
        return str;
    }
}

function handleKeyUp(evt) {
    switch (evt.keyCode) {
        case 37:    // left
            planes[0].target_dir = (planes[0].target_dir + 350) % 360;
            break;
        case 39:    // right
            planes[0].target_dir = (planes[0].target_dir + 10) % 360;
            break;
        case 40:    // down
            planes[0].target_alt = Math.max(0,planes[0].target_alt-1000);
            break;
        case 38:    // up
            planes[0].target_alt = planes[0].target_alt+1000;
            break;

        case 'n'.charCodeAt(0):
            planes[0].state = (planes[0].state + 1) % PLANE_COLORS.length;
            break;

        case 33:    // PgUp
            planes[0].target_speed = planes[0].target_speed + 10;
            break;
        case 34:    // PgDn
            planes[0].target_speed = Math.max(0, planes[0].target_speed - 10);
            break;
        default:
            break;
    }
    draw();
}

window.addEventListener('keypress', handleKeyUp, true);

var planes = [];
var canvas;
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
        planes[i].updatepos(1000 / 1000.);
    }

    draw();

    setTimeout('step()',1000);
}

function draw() {
    context.fillStyle = "#000000";
    context.strokeStyle = "#00ff00";
    context.lineCap="butt";
    context.font="9px Arial";
    context.lineWidth = 1;

    drawworld();
    for (i = 0; i < planes.length; i = i + 1) {
        drawplane(planes[i]);
    }

    drawtextarea();
}

function drawworld() {
    context.fillstyle="#000000";
    context.fillRect(0,0,640,480);  // clear the canvas
}

function drawtextarea() {
    context.fillStyle="#000000";
    context.fillRect(0, canvas.height-15, 640, 15);
    context.fillStyle="#00ff00";
    context.fillText("Target direction: " + planes[0].target_dir, 10, canvas.height-5);
}

function drawplane(p) {
    var dx = p.x-2.5, dy = p.y-2.5;
    var sticklen = 20;
    var radang=p.draw_dir();
    var lx1 = p.x + 5*Math.cos(radang),
        ly1 = p.y + 5*Math.sin(radang),
        lx2 = p.x + sticklen*Math.cos(radang),
        ly2 = p.y + sticklen*Math.sin(radang);

    context.strokeStyle = PLANE_COLORS[p.state];
    context.fillStyle = PLANE_COLORS[p.state];

    context.strokeRect(dx,dy,5,5);
    context.beginPath();
    context.moveTo(lx1,ly1);
    context.lineTo(lx2,ly2);
    context.stroke();

    txt = p.alt_string();
    
    tw = context.measureText(txt).width;
    th = context.measureText(txt).height;

    if (p.dir < 180) {
        tx = p.x - tw - 5;
    } else {
        tx = p.x + 5;
    }
    ty = p.y;

    context.fillText(p.id, tx, ty-11);
    context.fillText(txt, tx, ty);
    context.fillText(""+p.speed, tx, ty+11);
}
