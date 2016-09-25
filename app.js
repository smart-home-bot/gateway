// https://github.com/ThingLabsIo/IoTLabs/tree/master/Arduino/Weather
'use strict';

var five = require("johnny-five");
var Shield = require("j5-sparkfun-weather-shield")(five);
var device = require('azure-iot-device');

if (process.argv.length != 3) {
    console.log('please provide device com port');
    return;
}

var comPort = process.argv[2];

var connectionString = process.env.IOTHUB_CONNECTION_STRING || 'HostName=smart-home-bot.azure-devices.net;DeviceId=HomeIotGateway;SharedAccessKey=ADGq4aFRFacADVCZDBGDAGH==';

// Define the protocol that will be used to send messages to Azure IoT Hub
// For this lab we will use AMQP over Web Sockets.
// If you want to use a different protocol, comment out the protocol you want to replace, 
// and uncomment one of the other transports.
//var Protocol = require('azure-iot-device-amqp-ws').AmqpWs;
var Protocol = require('azure-iot-device-amqp').Amqp;
// var Protocol = require('azure-iot-device-http').Http;
// var Protocol = require('azure-iot-device-mqtt').Mqtt;

// Define the client object that communicates with Azure IoT Hubs
var Client = require('azure-iot-device').Client;
// Define the message object that will define the message format going into Azure IoT Hubs
var Message = require('azure-iot-device').Message;
// Create the client instanxe that will manage the connection to your IoT Hub
// The client is created in the context of an Azure IoT device.
var client = Client.fromConnectionString(connectionString, Protocol);
// Extract the Azure IoT Hub device ID from the connection string 
// (this may not be the same as the Photon device ID)
var deviceId = device.ConnectionString.parse(connectionString).DeviceId;

console.log("Device ID: " + deviceId);

console.log("Connecting sparkfun board on com port: " + comPort);

// Create a Johnny-Five board instance to represent your Particle Photon
// Board is simply an abstraction of the physical hardware, whether is is a 
// Photon, Arduino, Raspberry Pi or other boards. 
var board = new five.Board({ port: comPort });

/*
// You may optionally specify the port by providing it as a property
// of the options object parameter. * Denotes system specific 
// enumeration value (ie. a number)
// OSX
new five.Board({ port: "/dev/tty.usbmodem****" });
// Linux
new five.Board({ port: "/dev/ttyUSB*" });
// Windows
new five.Board({ port: "COM*" });
*/


// Send device meta data
var deviceMetaData = {
    'ObjectType': 'DeviceInfo',
    'IsSimulatedDevice': 0,
    'Version': '1.0',
    'DeviceProperties': {
        'DeviceID': deviceId,
        'HubEnabledState': 1,
        'CreatedTime': '2016-09-21T20:28:55.5448990Z',
        'DeviceState': 'normal',
        'UpdatedTime': null,
        'Manufacturer': 'SparkFun',
        'ModelNumber': 'RedBoard DEV-12757',
        'SerialNumber': 'SER9090',
        'FirmwareVersion': '1.10',
        'Platform': 'node.js',
        'Processor': 'ATmega328',
        'InstalledRAM': '32 KB',
        'Latitude': 32.006571,
        'Longitude': 34.794896
    },
    'Commands': [
        {
            'Name': 'TurnOnLightsInRoom',
            'Parameters': [
                { 'Name': 'Room', 'Type': 'string' },
                { 'Name': 'TurnOn', 'Type': 'boolean' }]
        },
        {
            'Name': 'TurnOffLightsInRoom',
            'Parameters': [
                { 'Name': 'Room', 'Type': 'string' },
                { 'Name': 'TurnOn', 'Type': 'boolean' }]
        },
        {
            'Name': 'TurnAC',
            'Parameters': [
                { 'Name': 'Room', 'Type': 'string' },
                { 'Name': 'TurnOn', 'Type': 'boolean' }]
        },
        {
            'Name': 'SetACTemperature',
            'Parameters': [
                { 'Name': 'Room', 'Type': 'string' },
                { 'Name': 'Temperature', 'Type': 'double' }]
        }]
};

var rooms = ['kitchen', 'terrace', 'livingroom', "boy's room", 'bedroom', 'bathroom', "girl's room"];


// The board.on() executes the anonymous function when the 
// board reports back that it is initialized and ready.
board.on("ready", function () {
    console.log("Board connected...");
    var lights = {
        'kitchen': new five.Led(3),
        'terrace': new five.Led(5),
        'livingroom': new five.Led(6),
        "boy's room": new five.Led(7),
        'bedroom': new five.Led(8),
        'bathroom': new five.Led(9),
        "girl's room": new five.Led(10),
    };


    // Open the connection to Azure IoT Hub
    // When the connection respondes (either open or error)
    // the anonymous function is executed
    client.open(function (err) {
        console.log("Azure IoT connection open...");

        if (err) {
            // If there is a connection error, show it
            printErrorFor('open')(err);
        } else {
            // If the client gets an error, handle it
            client.on('error', function (err) {
                printErrorFor('client')(err);
                if (sendInterval) {
                    clearInterval(sendInterval);
                }
                client.close();
            });

            // send device metadata to iot suite backoffice
            //console.log('Sending device metadata:\n' + JSON.stringify(deviceMetaData));
            console.log('Sending device metadata');

            client.sendEvent(new Message(JSON.stringify(deviceMetaData)), printErrorFor('send metadata'));

            client.on('message', function (msg) {
                //console.log('receive data: ' + msg.getData());

                try {
                    var command;
                    // Microsoft bot framework channel emulator 
                    if (msg.data.length) {
                        command = JSON.parse(msg.getData());
                    }
                    // real bot
                    else {
                        command = JSON.parse(msg.data.data);
                    }

                    switch (command.Name) {
                        case 'TurnOnLightsInRoom':
                        case 'TurnOffLightsInRoom':
                            {
                                var room = command.Parameters.Room;
                                var turnOn = command.Parameters.TurnOn;

                                if (room == 'all') {
                                    rooms.forEach(function (key) {
                                        console.log('set light on the ' + key + ' to ' + turnOn);
                                        if (turnOn) {
                                            lights[key].on();
                                        }
                                        else {
                                            lights[key].off();
                                        }
                                    });
                                }
                                else {
                                    var light = lights[room];
                                    if (light) {
                                        if (turnOn) {
                                            light.on();
                                        }
                                        else {
                                            light.off();
                                        }
                                        console.log('set light on the ' + room + ' to ' + turnOn);
                                        client.complete(msg, printResultFor('complete'));
                                    }
                                    else {
                                        console.log('failed setting light on the ' + room + ' to ' + turnOn + ', room was not found!');
                                        client.reject(msg, printErrorFor('reject'));
                                    }
                                }

                                break;
                            }
                        case 'TurnAC':
                            {
                                var room = command.Parameters.Room;
                                var turnOn = command.Parameters.TurnOn;

                                console.log('set AC on the ' + room + ' to ' + turnOn);
                                client.complete(msg, printErrorFor('complete'));
                                break;
                            }
                        case 'SetACTemperature':
                            {
                                var room = command.Parameters.Room;
                                var temperature = command.Parameters.Temperature;

                                console.log('set AC temperature on the ' + room + ' to ' + temperature + 'C');
                                client.complete(msg, printErrorFor('complete'));
                                break;
                            }
                        default:
                            {
                                console.log('command ' + command.Name + ' is not supported');
                                client.reject(msg, printErrorFor('reject'));
                                break;
                            }
                    }
                }
                catch (err) {
                    printErrorFor('parse received message')(err);
                    client.reject(msg, printErrorFor('reject'));
                }
            });

            // If the connection opens, set up the weather shield object

            // The SparkFun Weather Shield has two sensors on the I2C bus - 
            // a humidity sensor (HTU21D) which can provide both humidity and temperature, and a 
            // barometer (MPL3115A2) which can provide both barometric pressure and humidity.
            // Controllers for these are wrapped in a convenient plugin class:
            var weather = new Shield({
                variant: "ARDUINO", // or PHOTON
                freq: 5000,         // Set the callback frequency to 1-second
                elevation: 100      // Go to http://www.WhatIsMyElevation.com to get your current elevation
            });


            // The weather.on("data", callback) function invokes the anonymous callback function 
            // whenever the data from the sensor changes (no faster than every 25ms). The anonymous 
            // function is scoped to the object (e.g. this == the instance of Weather class object). 
            console.log("sending device telemetry...");
            weather.on("data", function () {
                //console.log("weather data event fired...");
                var payload = JSON.stringify({
                    "DeviceId": deviceId,
                    "Temperature": this.celsius,
                    "Humidity": this.relativeHumidity//,
                    //"ExternalTemperature": null,
                });

                // Create the message based on the payload JSON
                var message = new Message(payload);
                // For debugging purposes, write out the message payload to the console
                //console.log("Sending message: " + message.getData());
                // Send the message to Azure IoT Hub
                client.sendEvent(message, printErrorFor('send'));
            });
        }
    });
});

// Helper function to print results in the console
function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}

// Helper function to print results for an operation
function printErrorFor(op) {
    return function printError(err) {
        if (err) console.log(op + ' error: ' + err.toString());
    };
}
