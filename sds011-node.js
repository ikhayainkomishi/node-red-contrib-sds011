const SerialPort = require('serialport');

let node;
let serial;
let deviceId;

module.exports = function(RED) {
  function sds011Sensor(config) {
    RED.nodes.createNode(this, config);
    node = this;
    deviceId = 0xFFFF;
    serial = new SerialPort(config.port, {
      baudRate: 9600,
      parser: serialParser()
    });
    serial.on('open', function() {
      node.log('Serial port is open');
      node.status({fill: 'green', shape: 'dot', text: 'connected'});
    });
    serial.on('error', function(err) {
      if (err) {
        node.error('Serial port error', err);
      }
      node.status({fill: 'red', shape: 'ring', text: 'error'});
    });
    serial.on('close', function() {
      node.log('Serial port is closed');
      node.status({fill: 'red', shape: 'ring', text: 'disconnected'});
    });
    let parser = serialParser();
    serial.on('data', function(data) {
      parser(data);
    });

    node.on('input', function(msg) {
      let command;
      let parameter;
      if (msg.command === undefined) {
        command = msg.payload;
      } else {
        command = msg.command;
        parameter = msg.parameter;
      }
      node.log('Command: ' + command + ' Parameter: ' + parameter);
      switch (command) {
        case 'setDataReportingMode':
          setDataReportingMode(parameter);
          break;
        case 'setActive':
          setDataReportingMode('active');
          break;
        case 'setQuery':
          setDataReportingMode('query');
          break;
        case 'getDataReportingMode':
          getDataReportingMode();
          break;
        case 'queryData':
          queryData();
          break;
        case 'setDeviceId':
          setDeviceId(parameter);
          break;
        case 'setStatus':
          setStatus(parameter);
          break;
        case 'sleep':
          setStatus('sleep');
          break;
        case 'work':
          setStatus('work');
          break;
        case 'getStatus':
          getStatus();
          break;
        case 'setWorkingPeriod':
          setWorkingPeriod(parameter);
          break;
        case 'setContinuousMode':
          setWorkingPeriod(0);
          break;
        case 'getWorkingPeriod':
          getWorkingPeriod();
          break;
        case 'checkFirmwareVersion':
          checkFirmwareVersion();
          break;
        default:
          node.error('Unknown command: ' + msg.payload);
          break;
      }

      // get the device id of the sensor
      checkFirmwareVersion(deviceId);
    });

    node.on('close', function() {
      serial.close(function(err) {
        if (err) {
          node.error('Serial close error', err);
        }
      });
    });
  }
  RED.nodes.registerType('rpi-sds011', sds011Sensor);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#############################################################################################################################//
//#                                                                                                                           #//
//# documentation can be found at https://cdn.sparkfun.com/assets/parts/1/2/2/7/5/Laser_Dust_Sensor_Control_Protocol_V1.3.pdf #//
//#                                                                                                                           #//
//#############################################################################################################################//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function sendBuffer(buffer) {
  serial.write(buffer, 'hex');
}

// set data reporting mode
// mode: 'active' / 'query'
// deviceID: 0xFFFF for all peripherals
function setDataReportingMode(mode, deviceID=deviceId) {
  let data = '0201'+(mode==='active'?'00':'01')+'00000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// get data reporting mode
// deviceID: 0xFFFF for all peripherals
function getDataReportingMode(deviceID=deviceId) {
  let data = '02000000000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// query data command
function queryData(deviceID=deviceId) {
  let data = '04000000000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// set device ID
function setDeviceId(newDeviceID, deviceID=deviceId) {
  let data = '0500000000000000000000'+newDeviceID.toString(16).padStart(4, 0)+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// set sleep and work
// mode: 'sleep' / 'work'
function setStatus(mode, deviceID=deviceId) {
  let data = '0601'+(mode==='sleep'?'00':'01')+'00000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// get sleep and work
function getStatus(deviceID=deviceId) {
  let data = '06000000000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// set working period
// period: 0 for continues
//         n for work 30 sec and sleep n*60-30 secs.
function setWorkingPeriod(period, deviceID=deviceId) {
  period = ('00'+(period).toString(16)).substr(-2);
  let data = '0801'+period+'00000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// get working period
function getWorkingPeriod(deviceID=deviceId) {
  let data = '08000000000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

// check formware version
function checkFirmwareVersion(deviceID=deviceId) {
  let data = '07000000000000000000000000'+deviceID.toString(16).padStart(4, 0);
  let crc = ('00'+(calcCrcFromData(new Buffer(data, 'hex'))).toString(16)).substr(-2);
  let buffer = new Buffer('AAB4'+data+crc+'AB', 'hex');
  sendBuffer(buffer);
}

function getNextBeginning(buffer) {
  let start = buffer.indexOf('AA', 'hex');
  if (start === -1) {
    return new Buffer(0);
  }
  return buffer.slice(start);
}

function serialParser() {
  let serialData = new Buffer(0);
  return function(buffer) {
    serialData = Buffer.concat([serialData, buffer]);

    // find message beginning
    if (serialData[0] != 0xAA) {
      serialData = getNextBeginning(serialData);
    }
    // check buffer length
    if (serialData.length < 10) {
      node.debug('buffer is not long enough: ' + buffer.length);
      return;
    }
    // check checksum and tail
    if (!checkCrc(serialData) || (serialData[9] != 0xAB)) {
      node.debug('wrong checksum/tail: ' + buffer[9]);
      serialData = serialData.slice(10);
      return;
    }
    parseMessage(serialData);
    serialData = new Buffer(0);
  }
};

// Message format:
//   0 HEADER AA
//   1 COMMAND
//   2 DATA
//   3 DATA
//   4 DATA
//   5 DATA
//   6 DATA
//   7 DATA
//   8 Check-sum
//   9 TAIL AB
function parseMessage(buffer) {
  deviceId = buffer[6] << 8 | buffer[7]
  let ret = {};
  // check command
  switch (buffer[1]) {
    case 0xC0:
      // PM values
      //   2 DATA PM2.5 Low byte
      //   3 DATA PM2.5 High byte
      //   4 DATA PM10 Low byte
      //   5 DATA PM10 High byte
      //   6 DATA Device ID Low byte
      //   7 DATA Device ID High byte

      // Extract PM values
      // PM2.5 (ug/m3) = ((PM2.5 High byte *256) + PM2.5 low byte) / 10
      // PM10 (ug/m3) = ((PM10 high byte*256) + PM10 low byte) / 10// PM2.5:
      let pm2_5 = (buffer[2] | (buffer[3] << 8)) / 10.0;
      let pm10 = (buffer[4] | (buffer[5] << 8)) / 10.0;

      sendPMValues(pm2_5, pm10);
      break;
    case 0xC5:
      switch (buffer[2]) {
        case 2:
          // data reporting mode
          //   2 DATA 2
          //   3 DATA 0: query the current mode
          //          1: set reporting mode
          //   4 DATA 0: report active mode
          //          1: report query mode
          //   5 DATA 0
          //   6 DATA Device ID Low byte
          //   7 DATA Device ID High byte

          if (buffer[4] === 0) {
            sendInfo('Sensor is in active mode');
          } else {
            sendInfo('Sensor is in query mode');
          }
          break;
        case 5:
          // set device ID
          //   2 DATA 5
          //   3 DATA 0
          //   4 DATA 0
          //   5 DATA 0
          //   6 DATA New Device ID Low byte
          //   7 DATA New Device ID High byte

          sendInfo('Sensor has a new Device ID: 0x' + buffer[6].toString(16) + buffer[7].toString(16));
          break;
        case 6:
          // set sleep and work
          //   2 DATA 6
          //   3 DATA 0: query the current mode
          //          1: set mode
          //   4 DATA 0: sleep
          //          1: work
          //   5 DATA 0
          //   6 DATA Device ID Low byte
          //   7 DATA Device ID High byte

          if (buffer[4] === 0) {
            sendInfo('Sensor is in sleep mode');
          } else {
            sendInfo('Sensor is in work mode');
          }
          break;
        case 7:
          // check firmware version
          //   2 DATA 7
          //   3 DATA Firmware version year
          //   4 DATA Firmware version month
          //   5 DATA Firmware version day
          //   6 DATA Device ID Low byte
          //   7 DATA Device ID High byte

          sendInfo('Firmware: ' + buffer[5] + '.' + buffer[4] + '.' + buffer[3]);
          break;
        case 8:
          // set working period
          //   2 DATA 8
          //   3 DATA 0: query the current mode
          //          1: set mode
          //   4 DATA 0: continues(default)
          //          1-30minute: work 30 secs and sleep n*60-30 secs
          //   5 DATA 0
          //   6 DATA Device ID Low byte
          //   7 DATA Device ID High byte

          if (buffer[4] === 0) {
            sendInfo('Sensor is in continuous mode');
          } else {
            sendInfo('Sensor works 30 seconds and sleeps for ' + (buffer[4]-1).toString() + ' minutes and 30 seconds.');
          }
          break;
        default:
          break;
      }
      break;
    default:
      sendInfo('received a unknown command: ' + buffer[1].toString(16));
      return;
  }
  return ret;
}

function calcCrcFromData(data) {
  let crc = data.reduce(function(prev, curr) {
    return prev + curr;
  });
  crc &= 0xFF;
  return crc;
}

function calcCrcFromBuffer(buffer) {
  let crc = calcCrcFromData(buffer.slice(2, 8));
  return crc;
}

function checkCrc(buffer) {
  let calcCrc = calcCrcFromBuffer(buffer);
  return calcCrc === buffer[8];
}

function sendPMValues(pm2_5, pm10) {
  let time = new Date();
  node.send([
    {payload: pm2_5, title: 'PM2.5 value', topic: 'PM2_5', description: 'PM2.5 value in ug/m3', time: time},
    {payload: pm10, title: 'PM10 value', topic: 'PM10', description: 'PM10 value in ug/m3', time: time},
    null
  ]);
}

function sendInfo(msg) {
  let time = new Date();
  node.log(msg);
  node.send([ null, null, {payload: msg, time: time, deviceId: deviceId} ]);
}
