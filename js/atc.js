var eps = .0000001;

var STATE_NORMAL       = 0,
    STATE_ALERT        = 1,
    STATE_UNCONTOLLED  = 2;

var NAVAID_VOR      = 0,
    NAVAID_DME      = 1,
    NAVAID_VORDME   = 2,
    NAVAID_FIX      = 3;

var BG = "#000",
    PLANE_COLORS = ["#0f0","#f00","#00f"],
    NAVAID_COLORS = ["#1994d1", "#1994d1","#1994d1","#1994d1"],
    AIRPORT_COLOR = "#7f7f7f";

var nmPerPixel = 1/5.;

function navaid(_id,_x,_y,_type,_textloc) {
    this.id = _id;
    this.x = _x;
    this.y = _y;
    this.textloc = _textloc;
    this.type = _type;
}

var navaids = [new navaid("ARL",65.0,44.0,NAVAID_VORDME,'l'),
    new navaid("BALVI",55.0,39.0,NAVAID_FIX,'l'),
    new navaid("TRS", 54.2, 81.7, NAVAID_VORDME,'r'),
    new navaid("HMR", 78.8, 13.3, NAVAID_VORDME,'r'),
    new navaid("TEB", 76.1, 50.8, NAVAID_VORDME,'r'),
    new navaid("BABAP", 95.1, 56, NAVAID_FIX,'r'),
    new navaid("XILAN", 107.3, 41.3, NAVAID_FIX,'r'),
    new navaid("NTL", 95.5, 35, NAVAID_VORDME,'r'),
    new navaid("ARS", 24.9, 49.7, NAVAID_VORDME,'r'),
    new navaid("DKR", 36.2, 65.1, NAVAID_VOR,'r'),
    new navaid("NOSLI", 45.1, 73.1, NAVAID_FIX,'r'),
    new navaid("ELTOK", 37.0, 32.0, NAVAID_FIX,'r'),
    new navaid("RESNA", 65.5, 7.0, NAVAID_FIX,'r'),
    new navaid("KOGAV", 45.2, 13.0, NAVAID_FIX,'r'),
    ];
var lookup_navaid = {};

function airport(_id,_txtpos,_rwys) {
    this.id = _id;
    this.txtpos = _txtpos;
    this.rwys = _rwys;
}

function runway(_mod,_x1,_y1,_len,_dir) {
    this.mod = _mod;
    this.x1 = _x1;
    this.y1 = _y1;
    this.len = _len;
    this.dir = _dir;
    this.draw_dir = (_dir + 270) * Math.PI / 180;
    this.x2 = _x1 + _len*Math.cos(this.draw_dir);
    this.y2 = _y1 + _len*Math.sin(this.draw_dir);
}

var essb = new airport("ESSB", {x:68,y:61.5} ,[new runway('', 66.8, 63.0, 0.9, 300.0)]);
var essa = new airport("ESSA", {x:68,y:44}, [new runway('L',65.0,45.0,1.8,5), // ILS 1R,1L,19L,19R,26
        new runway('R',66.5,45.5,1.5,5),
        new runway('',65.8,43.6,1.5,71)]);
var esow = new airport("ESOW", {x:17,y:49.8}, [new runway('', 24.4, 50.4, 1.4, 8)]); // ILS 19
var airports = [essb,essa,esow];

function dist(x1,y1,x2,y2) {
    dx = x2-x1;
    dy = y2-y1;
    return Math.sqrt(dx*dx + dy*dy);
}

/*
 * let each pixel denote 1/10 nm
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
        var d = this.draw_dir();
        var dlen = (this.speed/3600.)   // nm per second
            * dt;                   // nm since last
        this.x = this.x + dlen * Math.cos(d);
        this.y = this.y + dlen * Math.sin(d);

        /* update the plane's altitude */
        var dalt = this.target_alt - this.alt;
        if (Math.abs(dalt) > eps) {
            var sdalt = dalt / Math.abs(dalt);
            this.alt = this.alt + sdalt * Math.min(sdalt*dalt, (this.fpm/60.) * dt);
        }

        /* update the plane's direction */
        var ddir = this.target_dir - this.dir;
        if (Math.abs(ddir) > eps) {
            var sddir = ddir / Math.abs(ddir);
            if (Math.abs(ddir) > 180) {
                ddir = this.target_dir - sddir*360 - this.dir;
            }
            sddir = ddir / Math.abs(ddir);
            this.dir = this.dir + sddir * Math.min(sddir*ddir, this.turnrate * dt);
            this.dir = (this.dir + 360) % 360;
        }

        /* update the plane's speed */
        var dspd = this.target_speed - this.speed;
        if (Math.abs(dspd) > eps) {
            var sdspd = dspd / Math.abs(dspd);
            this.speed = this.speed + sdspd * Math.min(sdspd*dspd, this.acceleration * dt);
        }
    }

    this.draw_dir = function() {
        return (this.dir + 270) * Math.PI / 180;
    }

    this.alt_string = function() {
        var str = "" + Math.round(this.target_alt/100);
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
    planes.push(new plane('a', 15.0,15.0,10000,100,100));
    canvas = document.getElementById("game");
    context = canvas.getContext('2d');

    for (var i = 0; i < navaids.length; i = i + 1) {
        lookup_navaid[navaids[i].id] = i;
    }
}

function step() {
    for (var i = 0; i < planes.length; i = i + 1) {
        planes[i].updatepos(1000 / 1000.);
    }

    draw();

    setTimeout('step()',1000);
}

function draw() {
    context.fillStyle = "#000000";
    context.strokeStyle = "#00ff00";
    context.lineCap="butt";
    context.font="bold 9px Arial";
    context.textBaseline = "middle";
    context.lineWidth = 1;

    drawworld();
    
    context.font="9px Arial";
    for (var i = 0; i < planes.length; i = i + 1) {
        drawplane(planes[i]);
    }

    drawtextarea();
}

function drawworld() {
    context.fillstyle="#000000";
    context.fillRect(0,0,canvas.width,canvas.height);  // clear the canvas

    for (var i = 0; i < airports.length; i = i + 1) {
        draw_airport(airports[i]);
        asdads = i;
    }
    context.lineWidth = 1;

    for (var i = 0; i < navaids.length; i = i + 1) {
        draw_navaid(navaids[i]);
    }
}

var asdads = "";

function draw_airport(a) {
    context.lineWidth = 2;
    context.strokeStyle = AIRPORT_COLOR;
    context.fillStyle = AIRPORT_COLOR;

    context.fillText(a.id, a.txtpos.x/nmPerPixel, a.txtpos.y/nmPerPixel);

    for (var j = 0; j < a.rwys.length; j = j + 1) {
        context.beginPath();
        rwy = a.rwys[j];
        context.moveTo(rwy.x1/nmPerPixel,rwy.y1/nmPerPixel);
        context.lineTo(rwy.x2/nmPerPixel,rwy.y2/nmPerPixel);
        context.stroke();
    }
    context.lineWidth = 1;
}

function drawtextarea() {
    context.fillStyle="#000000";
    context.fillRect(0, canvas.height-15, canvas.width, 15);
    context.fillStyle="#00ff00";
    context.fillText("Target direction: " + planes[0].target_dir + "; " + asdads, 10, canvas.height-5);
}

function draw_vor(v) {
    x = v.x / nmPerPixel;
    y = v.y / nmPerPixel;
    context.beginPath();
    context.moveTo(x-5.5, y);
    context.lineTo(x-3, y+5.5);
    context.lineTo(x+3, y+5.5);
    context.lineTo(x+5.5, y);
    context.lineTo(x+3, y-5.5);
    context.lineTo(x-3, y-5.5);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.arc(x,y,1,0,2*Math.PI);
    context.fill();
}

function draw_dme(v) {
    var x = v.x/nmPerPixel, y = v.y/nmPerPixel;
    var dx = x - 5.5, dy = y - 5.5;
    context.strokeRect(dx,dy,11,11);
    
    context.beginPath();
    context.arc(x,y,1,0,2*Math.PI);
    context.fill();
}

function draw_fix(v) {
    var x = v.x/nmPerPixel, y = v.y/nmPerPixel;
    context.beginPath();
    context.moveTo(x-7,y+4);
    context.lineTo(x+7,y+4);
    context.lineTo(x,y-7);
    context.closePath();
    context.stroke();
}

function draw_navaid(v) {
    context.strokeStyle = NAVAID_COLORS[v.type];
    context.fillStyle = NAVAID_COLORS[v.type];
    switch (v.type) {
        case NAVAID_VORDME:
            draw_dme(v);
            draw_vor(v);
            break;
        case NAVAID_DME:
            draw_dme(v);
            break;
        case NAVAID_VOR:
            draw_vor(v);
            break;
        case NAVAID_FIX:
            draw_fix(v);
            break;
        default:
            break;
    }

    var tx = v.x/nmPerPixel;
    var ty = v.y/nmPerPixel;
    if (v.textloc == 'l') {
        tx = tx - context.measureText(v.id).width - 10;
    } else {
        tx = tx + 8;
    }

    context.fillText(v.id, tx, ty);
}

function drawplane(p) {
    var x = p.x/nmPerPixel, y = p.y/nmPerPixel;
    var dx = x-2.5, dy = y-2.5;
    var sticklen = 20;
    var radang=p.draw_dir();
    var lx1 = x + 5*Math.cos(radang),
        ly1 = y + 5*Math.sin(radang),
        lx2 = x + sticklen*Math.cos(radang),
        ly2 = y + sticklen*Math.sin(radang);

    context.strokeStyle = PLANE_COLORS[p.state];
    context.fillStyle = PLANE_COLORS[p.state];

    context.strokeRect(dx,dy,5,5);
    context.beginPath();
    context.moveTo(lx1,ly1);
    context.lineTo(lx2,ly2);
    context.stroke();

    var txt = p.alt_string();
    
    var tw = context.measureText(txt).width;
    var th = context.measureText(txt).height;
    var tx,ty;

    if (p.dir < 180) {
        tx = x - tw - 5;
    } else {
        tx = x + 5;
    }
    ty = y;

    context.fillText(p.id, tx, ty-11);
    context.fillText(txt, tx, ty);
    context.fillText(""+p.speed, tx, ty+11);
}
