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
    AIRPORT_COLOR = "#7f7f7f",
    TMA_BOUNDARY_COLOR = "#3f3f3f";

var nmPerPixel = 1/5.;

var acceleration = 10;

function navaid(_id,_x,_y,_type,_textloc) {
    this.id = _id;
    this.x = _x;
    this.y = _y;
    this.textloc = _textloc;
    this.type = _type;
}

var navaids = [
    new navaid("ARL",     65.0,  54.0,  NAVAID_VORDME,  'l'),
    new navaid("BALVI",   55.0,  49.0,  NAVAID_FIX,     'l'),
    new navaid("TRS",     54.2,  98.7,  NAVAID_VORDME,  'r'),
    new navaid("HMR",     78.8,   8.5,  NAVAID_VORDME,  'r'),
    new navaid("TEB",     76.1,  60.8,  NAVAID_VORDME,  'r'),
    new navaid("BABAP",   95.1,  66.0,  NAVAID_FIX,     'r'),
    new navaid("XILAN",  107.3,  51.3,  NAVAID_FIX,     'r'),
    new navaid("NTL",     95.5,  45.0,  NAVAID_VORDME,  'r'),
    new navaid("ARS",     24.9,  59.7,  NAVAID_VORDME,  'r'),
    new navaid("DKR",     36.2,  82.1,  NAVAID_VOR,     'r'),
    new navaid("NOSLI",   45.1,  90.1,  NAVAID_FIX,     'r'),
    new navaid("ELTOK",   37.0,  42.0,  NAVAID_FIX,     'r'),
    new navaid("RESNA",   65.5,   3.1,  NAVAID_FIX,     'r'),
    new navaid("KOGAV",   45.2,  23.0,  NAVAID_FIX,     'r'),
    ];
var lookup_navaid = {};

var tma_boundary_x = [ 50.6,  54.0, 85.8, 104.1, 84.7, 72.5, 57.9, 16.7, 9.4];
var tma_boundary_y = [ 97.9, 115.3, 81.9,    50, 9.4, 7.6,  11.2, 47.9, 96.9];

function airport(_id,_txtpos,_rwys) {
    this.id = _id;
    this.txtpos = _txtpos;
    this.rwys = _rwys;
    this.lookup_rwy = function(id) {
        for (var i = 0; i < this.rwys.length; ++i) {
            if (this.rwys[i].nearid == id) {
                return this.rwys[i].near();
                break;
            } else if (this.rwys[i].farid == id) {
                return this.rwys[i].far();
                break;
            }
        }
    }
}

function runway(_nearid,_farid,_x1,_y1,_len,_dir,_ilsnear,_ilsfar) {
    this.nearid = _nearid;
    this.farid = _farid;
    this.x1 = _x1;
    this.y1 = _y1;
    this.len = _len;
    this.dir = _dir;
    this.draw_dir = (_dir + 270) * Math.PI / 180;
    this.x2 = _x1 + _len*Math.cos(this.draw_dir);
    this.y2 = _y1 + _len*Math.sin(this.draw_dir);
    this.ils_near = _ilsnear;
    this.ils_far = _ilsfar;

    this.near = function() {
        return { x:this.x1, y:this.y1, dir:this.dir, ils:this.ils_near, id:this.nearid };
    }
    this.far = function() {
        return { x:this.x2, y:this.y2, dir:(this.dir + 180)%360, ils:this.ils_far, id:this.farid };
    }
}

var essb = new airport("ESSB", {x:68,y:71.5} ,[new runway('30','12', 66.8, 73.0, 0.9, 300.0, true, true)]);
var essa = new airport("ESSA", {x:68,y:54}, [
        new runway('01L', '19R', 65.0,   55.0,   1.8,    5,  true,   true), // ILS 1R,1L,19L,19R,26
        new runway('01R', '19L', 66.5,   55.5,   1.5,    5,  true,   true),
        new runway('08', '26', 65.8,   53.6,   1.5,    71, false,  true)]);
var esow = new airport("ESOW", {x:17,y:59.8}, [new runway('01','19', 24.4, 60.4, 1.4, 8, false, true)]); // ILS 19
var airports = [essb,essa,esow];

var lookup_airports = {};

function dist(x1,y1,x2,y2) {
    dx = x2-x1;
    dy = y2-y1;
    return Math.sqrt(dx*dx + dy*dy);
}

function cmd_hdg(plane, args) {
    /* set the proper heading target */
    plane.target_dir = args;
}

function cmd_hdg_fin(plane, args) {
    return true; // always ends at once
}

function cmd_direct(plane, args) {
    /* find the proper angle to the target */
    var px = plane.x, py = plane.y;
    var tx = args.x, ty = args.y;
    
    var ang = Math.round(Math.atan2(ty-py, tx-px)*180./Math.PI);
    ang = (ang + 360 + 90) % 360;   // normalize the angle and turn it into 

    plane.target_dir = ang;
}

function cmd_direct_fin(plane, args) {
    return dist(plane.x, plane.y, args.x, args.y) < 1.; // done when within half a mile of target
}

function cmd_ils(plane, args) {
    var ang_to_rwy = Math.round(Math.atan2(args.t.y-plane.y, args.t.x-plane.x)*180./Math.PI);
    ang_to_rwy = (ang_to_rwy + 360 + 90) % 360;
    if (!args.established) {
        /* check if the plane is established */

        var dd = Math.abs(ang_to_rwy - args.t.dir);
        if (dd > 180.) dd = 360 - dd;
        if (dd < 5.) {
            args.established = true;
        }
    } else {
        plane.target_dir = ang_to_rwy;

        var d = dist(plane.x,plane.y,args.t.x,args.t.y);
        plane.target_alt = Math.min(plane.target_alt, d*300);
    }
}

function cmd_ils_fin(plane, args) {
    return false;
/*    return plane.target_alt < 25.;
    if (args.established) {
        var ang_to_rwy = Math.round(Math.atan2(args.t.y-plane.y, args.t.x-plane.x)*180./Math.PI);
        ang_to_rwy = (ang_to_rwy + 360 + 90) % 360;
        var dd = Math.abs(ang_to_rwy - args.t.dir);
        if (dd > 180.) dd = 360 - dd;
        var d = dist(plane.x,plane.y,args.t.x,args.t.y);
        if (d < .5 && plane.alt > d*600) {
            return true;
        }
        if (dd > 20.) {
            return true;
        }
    }*/
}

var cmd_fcns = [ [cmd_hdg,cmd_direct,cmd_ils], [cmd_hdg_fin, cmd_direct_fin, cmd_ils_fin] ];

var CMD_HDG     = 0,
    CMD_DIRECT  = 1,
    CMD_ILS     = 2;

function cmd(_type, _args) {
    this.type = _type;
    this.args = _args;

    this.execute = function(plane) {
        cmd_fcns[0][this.type](plane, this.args);
    }

    this.finished = function(plane) {
        return cmd_fcns[1][this.type](plane, this.args);
    }
}

/*
 * let each pixel denote 1/10 nm
 */
function plane(_id,_x,_y,_alt,_dir,_speed,_cmds) {
    this.id = _id;
    this.x = _x;
    this.y = _y;
    this.dir = _dir;
    this.speed = _speed;
    this.alt = _alt;
    this.target_alt = _alt;
    this.target_dir = _dir;
    this.target_speed = _speed;

    this.cmds = _cmds;

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

        /* update the ap cmd */
        if (this.cmds.length == 0) {
            this.cmds.push(new cmd(CMD_HDG, this.target_dir));
        }

        this.cmds[0].execute(this);
        if (this.cmds[0].finished(this)) {
            this.cmds.shift();
        }

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

var KEY_ENTER   = 13,
    KEY_ESCAPE  = 27,
    KEY_SPACE   = 32,
    KEY_DEL     = 8,
    KEY_COMMA   = 188,  //44,
    KEY_A       = "A".charCodeAt(0),
    KEY_S       = "S".charCodeAt(0),
    KEY_H       = "H".charCodeAt(0),
    KEY_C       = "C".charCodeAt(0),
    KEY_V       = "V".charCodeAt(0),
    KEY_I       = "I".charCodeAt(0);

var ACTION_ALT      = KEY_A,
    ACTION_SPD      = KEY_S,
    ACTION_CLE      = KEY_C,
    ACTION_VIA      = KEY_V,
    ACTION_HDG      = KEY_H,
    ACTION_ILS      = KEY_I,
    INPUT_ABORT     = KEY_ESCAPE,
    INPUT_COMMIT    = KEY_ENTER,
    INPUT_NEXT      = KEY_COMMA,
    INPUT_BACK      = KEY_DEL;

var READ_STATE_PLANE_ID = 0,
    READ_STATE_ACTION   = 1,
    READ_STATE_ARG      = 2,
    READ_STATE_ALT_ARG  = 3,
    READ_STATE_SPD_ARG  = 4,
    READ_STATE_CLE_ARG  = 5,
    READ_STATE_VIA_ARG  = 6,
    READ_STATE_HDG_ARG  = 7;

var CMD_STRINGS = {
    "A" : "altitude",
    "S" : "speed",
    "C" : "cleared to",
    "V" : "via",
    "H" : "fly heading",
    "I" : "cleared ILS approach"
};

var current_cmd = [];
var current_read_state = READ_STATE_PLANE_ID;
var current_string = "";

function reset_cmd() {
    current_string = "";
    current_cmd = [];
    current_read_state = READ_STATE_PLANE_ID;
}

function commit_cmd() {
    if (current_read_state == READ_STATE_ARG) {
        current_cmd.push(current_string);
    }
    if (current_cmd.length > 0) {
        var p = planes[lookup_planes[current_cmd[0]]];
        if (p) {
            // plane is valid
            var valid = true;
            var alt = -1;
            var speed = -1;
            var cmds = [];
            for (var i = 1; i < current_cmd.length-1 && valid; i = i + 2) {
                switch (current_cmd[i]) {
                    case ACTION_ALT:
                        alt = parseInt(current_cmd[i+1],10);
                        valid = alt ? true : false;
                        break;
                    case ACTION_SPD:
                        speed = parseInt(current_cmd[i+1],10);
                        valid = speed ? true : false;
                        break;
                    case ACTION_HDG:
                        var h = parseInt(current_cmd[i+1],10);
                        valid = h ? true : false;
                        h = h % 360;
                        cmds.push(new cmd(CMD_HDG, h));
                        break;
                    case ACTION_CLE:
                        var n = navaids[lookup_navaid[current_cmd[i+1]]];
                        if (n) {
                            cmds.push(new cmd(CMD_DIRECT, n));
                        } else {
                            valid = false;
                        }
                        break;
                    case ACTION_VIA:
                        if (cmds.length != 1) {
                            valid = false;
                        } else {
                            var aid_names = current_cmd[i+1].split(" ");
                            var cc = cmds.pop();
                            if (aid_names.length > 0) {
                                for (var j = 0; j < aid_names.length && valid; j = j + 1) {
                                    var naid = navaids[lookup_navaid[aid_names[j]]];
                                    if (naid)
                                        cmds.push(new cmd(CMD_DIRECT, naid));
                                    else
                                        valid = false;
                                }
                            } else
                                valid = false;
                            cmds.push(cc);
                        }
                        break;
                    case ACTION_ILS:
                        var ilss = current_cmd[i+1].split(" ");
                        var airportid = ilss[0];
                        var rwyid = ilss[1];
                        valid = false;
                        var ap = lookup_airports[airportid];
                        if (ap) {
                            var rwy = ap.lookup_rwy(rwyid);
                            if (rwy && rwy.ils) {
                                valid = true;
                                cmds.push(new cmd(CMD_ILS, {t:rwy}));
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
        }
        // if the command is valid
        if (valid) {
            if (alt >= 0)
                p.target_alt = alt;
            if (speed >= 0)
                p.target_speed = speed;
            if (cmds.length > 0)
                p.cmds = cmds;
        }
    }
}

function cmd_string() {
    var str = "";
    for (var i = 0; i < current_cmd.length; i = i + 1) {
        if (i % 2 == 0) {
            str = str + current_cmd[i] + ", ";
        } else {
            str = str + CMD_STRINGS[String.fromCharCode(current_cmd[i])] + " ";
        }
    }
    return str + current_string;
}

function handleKey(evt) {
    var done = 1;
    if (current_read_state == READ_STATE_ACTION) {
        switch (evt.keyCode) {
            case ACTION_ALT:
            case ACTION_SPD:
            case ACTION_CLE:
            case ACTION_VIA:
            case ACTION_HDG:
            case ACTION_ILS:
                current_cmd.push(evt.keyCode);
                current_read_state = READ_STATE_ARG;
                done = 2;
                break;
            default:
                break;
        }
    }
    if (done == 1) {
        switch (evt.keyCode) {
            case INPUT_COMMIT:
                commit_cmd();
                // fall through
            case INPUT_ABORT:
                reset_cmd();
                break;
            case INPUT_NEXT:
                current_cmd.push(current_string);
                current_string = "";
                current_read_state = READ_STATE_ACTION;
                break;
            case INPUT_BACK:
                if (current_string.length > 0) {
                    current_string = current_string.substring(0,current_string.length-1);
                } else if (current_read_state == READ_STATE_ACTION) {
                    current_string = current_cmd.pop();
                    current_read_state = READ_STATE_ARG;
                } else {
                    current_cmd.pop();
                    current_read_state = current_cmd.length == 0 ? READ_STATE_PLANE_ID : READ_STATE_ACTION;
                }
                break;
            default:
                done = 0;
                break;
        }
    }

    if (done == 0) {
        if ((evt.keyCode >= "A".charCodeAt(0) && evt.keyCode <= "Z".charCodeAt(0)) ||
            (evt.keyCode >= "0".charCodeAt(0) && evt.keyCode <= "9".charCodeAt(0)) ||
            evt.keyCode == KEY_SPACE) {
            current_string = current_string + (String.fromCharCode(evt.keyCode));
            done = 3;
        }
    }

    draw();
}

function handleKeypress(e) {
    var suppress = false;
    switch (e.keyCode) {
        case INPUT_BACK:
        case INPUT_ABORT:
        case INPUT_NEXT:
        case INPUT_COMMIT:
        case 44:    // , in keypress mode
        case KEY_SPACE:
            suppress = true;
            break;
        default:
           break;
    }
    if (suppress) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    }
    return suppress;
}

if (window.addEventListener) {
    window.addEventListener('keydown', handleKey, false);
    window.addEventListener('keypress', handleKeypress, false);
}
if (window.attachEvent) {
    window.attachEvent('keydown', handleKey, false);
    window.attachEvent('keypress', handleKeypress, false);
}

var planes = [];
var lookup_planes = {};
var canvas;
var context;

function onload() {
    init();
    step();
}

function init() {
    canvas = document.getElementById("game");
    context = canvas.getContext('2d');

    for (var i = 0; i < navaids.length; i = i + 1) {
        lookup_navaid[navaids[i].id] = i;
    }
    
    planes.push(new plane('ASD123', 15.0,15.0,10000,180,250, 
                [
                new cmd(CMD_DIRECT, navaids[lookup_navaid["KOGAV"]]),
                new cmd(CMD_DIRECT, navaids[lookup_navaid["BALVI"]]),
                new cmd(CMD_HDG,180)]));
    planes.push(new plane('QWE123', 110.0,45.0,10000,180,250, 
                [
                new cmd(CMD_DIRECT, navaids[lookup_navaid["XILAN"]]),
                new cmd(CMD_DIRECT, navaids[lookup_navaid["TEB"]])]));
    
    for (var i = 0; i < planes.length; i = i + 1) {
        lookup_planes[planes[i].id] = i;
    }
}

function step() {
    for (var j = 0; j < acceleration; j = j + 1)
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

    context.strokeStyle = TMA_BOUNDARY_COLOR;
    context.beginPath();
    context.moveTo(tma_boundary_x[0]/nmPerPixel, tma_boundary_y[0]/nmPerPixel);
    for (var i = 1; i < tma_boundary_x.length; i = i + 1) {
        context.lineTo(tma_boundary_x[i]/nmPerPixel, tma_boundary_y[i]/nmPerPixel);
    }
    context.closePath();
    context.stroke();

    for (var i = 0; i < airports.length; i = i + 1) {
        draw_airport(airports[i]);
        asdads = i;
    }
    context.lineWidth = 1;

    for (var i = 0; i < navaids.length; i = i + 1) {
        draw_navaid(navaids[i]);
    }
}

function draw_airport(a) {
    context.lineWidth = 2;
    context.strokeStyle = AIRPORT_COLOR;
    context.fillStyle = AIRPORT_COLOR;

    context.fillText(a.id, a.txtpos.x/nmPerPixel, a.txtpos.y/nmPerPixel);

    for (var j = 0; j < a.rwys.length; j = j + 1) {
        context.strokeStyle = AIRPORT_COLOR;
        context.lineWidth = 2;
        var rwy = a.rwys[j];
        var x1 = rwy.x1/nmPerPixel, y1 = rwy.y1/nmPerPixel;
        var x2 = rwy.x2/nmPerPixel, y2 = rwy.y2/nmPerPixel;
        context.beginPath();
        context.moveTo(x1,y1);
        context.lineTo(x2,y2);
        context.stroke();


        context.lineWidth = 1;
        context.strokeStyle = "#007f00";
        var dir = rwy.draw_dir;
        var mid_ils_dist = 10 / nmPerPixel;
        var side_ils_dist = 12 / nmPerPixel;
        var dx1 = side_ils_dist*Math.cos(dir+Math.PI/32), dy1 = side_ils_dist*Math.sin(dir+Math.PI/32);
        var dx2 = mid_ils_dist*Math.cos(dir), dy2 = mid_ils_dist*Math.sin(dir);
        var dx3 = side_ils_dist*Math.cos(dir-Math.PI/32), dy3 = side_ils_dist*Math.sin(dir-Math.PI/32);
        if (rwy.ils_near) {
            context.beginPath();
            context.moveTo(x1,y1);
            context.lineTo(x1-dx1, y1-dy1);
            context.lineTo(x1-dx2, y1-dy2);
            context.lineTo(x1-dx3, y1-dy3);
            context.closePath();
            context.stroke();
        }

        if (rwy.ils_far) {
            context.beginPath();
            context.moveTo(x2,y2);
            context.lineTo(x2+dx1, y2+dy1);
            context.lineTo(x2+dx2, y2+dy2);
            context.lineTo(x2+dx3, y2+dy3);
            context.closePath();
            context.stroke();
        }

    }
    context.lineWidth = 1;
}

function drawtextarea() {
    context.fillStyle="#000000";
    context.fillRect(0, canvas.height-15, canvas.width, 15);
    context.fillStyle="#00ff00";
    context.fillText(": " + cmd_string() + "_", 10, canvas.height-5);
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
