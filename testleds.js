'use strict';

var five = require("johnny-five");
var Shield = require("j5-sparkfun-weather-shield")(five);
if (process.argv.length != 3) {
    console.log('please provide device com port');
    return;
}

var comPort = process.argv[2];
console.log("Connecting sparkfun board on com port: " + comPort);
var board = new five.Board({ port: comPort });
board.on("ready", function () {
    console.log("Board connected...");
    var lights = {
        'kitchen': new five.Led(3),
        'terace': new five.Led(5),
        'livingroom': new five.Led(6),
        "boy's room": new five.Led(7),
        'bedroom': new five.Led(8),
        'bathroom': new five.Led(9),
        "girl's room": new five.Led(10),
    };

    var arr = ['kitchen','terace','livingroom',"boy's room",'bedroom','bathroom', "girl's room"];

    arr.forEach(function(key) {
        console.log(key);
        lights[key].on();
    });
});
