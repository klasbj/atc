
var x=50,y=34,dir=120;

function handleKeyUp(evt) {
    switch (evt.keyCode) {
        case 37:    // left
            dir = (dir + 10) % 360;
            drawplane();
            break;
        case 39:    // right
            dir = (dir + 350) % 360;
            drawplane();
            break;
        default:
            break;
    }
}

window.addEventListener('keyup', handleKeyUp, true);

function onload() {
    drawplane();
}

function drawplane() {
    canvas = document.getElementById("game");
    if (canvas.getContext) {
        context = canvas.getContext('2d');
        context.fillStyle = "#000000";
        context.strokeStyle = "#00ff00";
        context.lineWidth = 1;
        context.lineCap="butt";
        context.fillRect(0,0,640,480);  // clear the canvas


        var dx = x-2.5, dy = y-2.5;
        var sticklen = 20;
        var radang=dir*Math.PI/180.;
        var lx1 = x + 5*Math.cos(radang),
            ly1 = y + 5*Math.sin(radang),
            lx2 = x + sticklen*Math.cos(radang),
            ly2 = y + sticklen*Math.sin(radang);

        context.strokeRect(dx,dy,5,5);
        context.beginPath();
        context.moveTo(lx1,ly1);
        context.lineTo(lx2,ly2);
        context.stroke();
    }
}
