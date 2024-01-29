var Service, Characteristic;
var request = require("request");
const defaultJSON = require('./../default.json')
const packageJSON = require('./../package.json')
const util = require('./../util.js')

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("messana-changeover", "ThermostatChangeover", ThermostatChangeover);
  homebridge.registerAccessory("messana-changeover", "SwitchAC", SwitchAC);
};

function ThermostatChangeover(log, config, api) {
  this.apikey = util.getApiKey(api)
  this.log = log;
  this.config = config
  this.id = config.id
  this.name = config.name;
  this.model = packageJSON.models[0];
  this.apiroute = util.staticValues.apiroute
  this.timeout = config.timeout || 5000;
  this.temperatureDisplayUnits = defaultJSON.temperatureUnit || 1;
  this.targetTemperature = 25;
  this.currentTemperature = 20;
  this.targetHeatingCoolingState = 3;
  this.heatingCoolingState = 1;
  this.defaultTemp = 70

  this.service = new Service.Thermostat(this.name);
}

ThermostatChangeover.prototype = {

  identify: function(callback) {
    // this.log("Identify requested!");
    callback();
  },

  getCurrentHeatingCoolingState: function(callback) {
    // this.log("[+] getCurrentHeatingCoolingState from:", this.apiroute + "/status");
    var url = this.apiroute + "/status";
    var json = {
      currentHeatingCoolingState: 0
    }
    // this.log("[*] targetHeatingCoolingState: %s", json.currentHeatingCoolingState);

    this.currentHeatingCoolingState = json.currentHeatingCoolingState;
    callback(null, this.currentHeatingCoolingState);
  },

  getTargetHeatingCoolingState: function(callback) {
    // this.log("[+] getMode from:", this.apiroute + defaultJSON.hc.apis.getMode + "0" + "?apikey=" + this.apikey);
    var url = this.apiroute + defaultJSON.system.apis.getSystemOn + "?apikey=" + this.apikey;
    util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error getting System State: %s", error.message);
        callback(error);
      } else {
        try{
          var json = JSON.parse(responseBody);
        }
        catch(err){
          callback(-1);
          return
        }
        this.onSystem = (json.status == 0)? false : true
        if(!this.onSystem) {
          this.modeHC = 0
          callback(null, this.modeHC);
        }
        else {
          var url = this.apiroute + defaultJSON.hc.apis.getMode + this.id + "?apikey=" + this.apikey;
          util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
            if (error) {
              this.log("[!] Error getting getMode: %s", error.message);
              callback(error);
            } else {
              try{
                var json = JSON.parse(responseBody);
              }
              catch(err){
                callback(-1);
                return
              }
              this.targetHeatingCoolingState = this.modeHC = json.value+1;
              callback(null, this.modeHC);
            }
          }.bind(this));

        }
      }
    }.bind(this));
  },

  setTargetHeatingCoolingState: function(value, callback) {
    if(!this.onSystem){
      this.log("System OFF - Unable to change mode")
      callback();
      return
    }
    this.log("[+] setMode from:", this.apiroute + defaultJSON.hc.apis.setMode + "?apikey=" + this.apikey);
    url = this.apiroute + defaultJSON.hc.apis.setMode + "?apikey=" + this.apikey;
    var body = { id: this.id, value: value - 1}
    console.log(body)
    util.httpRequest(url, body, 'PUT', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error setting setMode", error.message);
        callback(error);
      } else {
        this.log("[*] Sucessfully set setMode to %s", value);
        callback();
      }
    }.bind(this));
  },

  getCurrentTemperature: function(callback) {
    // this.log("[+] getCurrentTemperature from:", this.apiroute + defaultJSON.macrozone.apis.getCurrentTemperature + this.id + "?apikey=" + this.apikey);
    var url = this.apiroute + defaultJSON.macrozone.apis.getCurrentTemperature + this.id + "?apikey=" + this.apikey;
    util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error getting currentTemperature: %s", error.message);
        callback(error);
      } else {
        try{
          var json = JSON.parse(responseBody);
        }
        catch(err){
          callback(-1);
          return
        }
        this.currentTemperature = parseFloat(json.value);
        this.currentTemperature = util.convertF2C(this.currentTemperature, this.temperatureDisplayUnits)
        callback(null, this.currentTemperature.toFixed(2));
      }
    }.bind(this));
  },

  getTargetTemperature: function(callback) {
    // this.log("[+] getTargetTemperature from:", this.apiroute + defaultJSON.macrozone.apis.getTargetTemperature + this.id + "?apikey=" + this.apikey);
    var url = this.apiroute + defaultJSON.macrozone.apis.getTargetTemperature + this.id + "?apikey=" + this.apikey;
    util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error getting currentTemperature: %s", error.message);
        callback(error);
      } else {
        try{
          var json = JSON.parse(responseBody);
        }
        catch(err){
          callback(-1);
          return
        }
        this.targetTemperature = parseFloat(json.value);

        this.targetTemperature = util.convertF2C(this.targetTemperature, this.temperatureDisplayUnits)

        callback(null, this.targetTemperature.toFixed(1));
      }
    }.bind(this));
  },
  //
  // setTargetTemperature: function(value, callback) {
  //   this.targetTemperature = util.nextNearest(util.convertF2C(value, this.temperatureDisplayUnits), .5)
  //   // this.log("[+] setTargetTemperature from %s to %s", this.targetTemperature, value);
  //   var url = this.apiroute + defaultJSON.macrozone.apis.setTargetTemperature + "?apikey=" + this.apikey
  //   // this.log("[+]" + url + " - " + this.id + " - " + this.targetTemperature);
  //   var body = {
  //     id: this.id,
  //     value: this.targetTemperature
  //   }
  //   util.httpRequest(url, body, 'PUT', function(error, response, responseBody) {
  //     if (error) {
  //       this.log("[!!!!!!!] Error setting targetTemperature", error.message);
  //       callback(error);
  //     } else {
  //       this.log("[*******] Sucessfully set targetTemperature to %s", value);
  //       callback();
  //     }
  //   }.bind(this));
  // },

  getTemperatureDisplayUnits: function(callback) {
    // this.log("getTemperatureDisplayUnits:", this.temperatureDisplayUnits);
    callback(null, this.temperatureDisplayUnits);
  },

  setTemperatureDisplayUnits: function(value, callback) {
    // this.log("[*] setTemperatureDisplayUnits from %s to %s", this.temperatureDisplayUnits, value);
    this.temperatureDisplayUnits = 1;
    callback();
  },

  getName: function(callback) {
    // this.log("getName :", this.name);
    callback(null, this.name);
  },

  getServices: function() {
    // this.log("***** getServices *******");
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.Manufacturer, util.staticValues.manufacturer)
      .setCharacteristic(Characteristic.SerialNumber, defaultJSON.version);

    this.service
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.getCurrentHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.getTargetHeatingCoolingState.bind(this))
      .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.getTargetTemperature.bind(this))
      // .on('set', this.setTargetTemperature.bind(this));

    this.service
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.getTemperatureDisplayUnits.bind(this))
      .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.service
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getName.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 0.5
      });

    // this.service.getCharacteristic(Characteristic.TargetTemperature)
    //   .setProps({
    //     minValue: this._convertC2F(this.minTemp),
    //     maxValue: this._convertC2F(this.maxTemp),
    //     minStep: 0.5
    //   });

      this.service.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
          minValue: util.convertF2C(this.config.defaultTemp || this.defaultTemp, this.temperatureDisplayUnits),
          maxValue: util.convertF2C(this.config.defaultTemp  || this.defaultTemp, this.temperatureDisplayUnits),
        });

    setInterval(function() {

      this.getTargetTemperature(function(err, temp) {
        if (err) {temp = err;}
        this.service.getCharacteristic(Characteristic.TargetTemperature).updateValue(temp);
      }.bind(this));

      this.getTargetHeatingCoolingState(function(err, temp) {
        if (err) { temp = err; }
        this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(temp);
      }.bind(this));

    }.bind(this), defaultJSON.refreshMacrozone * 1000);

    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState).props.validValues = [1, 2, 3];
    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits ).props.minValue = defaultJSON.temperatureUnit;

    return [this.informationService, this.service];
  }
};


function SwitchAC(log, config, api) {
  this.apikey = util.getApiKey(api)
  this.log = log
  this.config = config
  this.name = config.name
  this.id = config.id || 0
  this.model = packageJSON.models[1];
  this.apiroute = util.staticValues.apiroute
  this.on = false
  this.service = new Service.Switch(this.name)
  this.enablesetAC = false
}

SwitchAC.prototype = {
  identify: function(callback) {
    callback();
  },

  getAC: function(callback) {
    // this.log("[+] getAC from:", this.apiroute + defaultJSON.hc.apis.getAC + this.id + "?apikey=" + this.apikey);
    var url = this.apiroute + defaultJSON.system.apis.getSystemOn + "?apikey=" + this.apikey;
    util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error getting System State: %s", error.message);
        callback(error);
      } else {
        try{
          var json = JSON.parse(responseBody);
        }
        catch(err){
          callback(-1);
          return
        }
        this.onSystem = (json.status == 0)? false : true
        if(!this.onSystem) {
          this.modeHC = 0
          callback(null, this.modeHC);
        }
        else {

          var url = this.apiroute + defaultJSON.hc.apis.getAC + this.id + "?apikey=" + this.apikey;
          util.httpRequest(url, '', 'GET', function(error, response, responseBody) {
            if (error) {
              this.log("[!] Error getting getAC: %s", error.message);
              callback(error);
            } else {
              try{
                var json = JSON.parse(responseBody);
              }
              catch(err){
                callback(-1);
                return
              }
              this.on = (json.status == 0)? false : true
              callback(null, this.on);
            }
          }.bind(this));

        }
      }
    }.bind(this));
  },

  setAC: function(value, callback) {
    if(!this.enablesetAC) return;
    // this.log("[+] setAC from:", this.apiroute + defaultJSON.hc.apis.setAC + "?apikey=" + this.apikey);
    var url = this.apiroute + defaultJSON.hc.apis.setAC + "?apikey=" + this.apikey;
    var body = {
      id: this.id,
      value: (value)? 1 : 0
    }
    util.httpRequest(url, body, 'PUT', function(error, response, responseBody) {
      if (error) {
        this.log("[!] Error setting setAC", error.message);
        callback(error);
      } else {
        // this.log("[*] Sucessfully set setAC to %s", value);
        callback();
      }
    }.bind(this));
  },

  getName: function(callback) {
    // this.log("getName :", this.name);
    callback(null, this.name);
  },

  getServices: function() {
    // this.log("***** getServices AC *******");
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.Manufacturer, util.staticValues.manufacturer)
      .setCharacteristic(Characteristic.SerialNumber, defaultJSON.version);

    this.service
      .getCharacteristic(Characteristic.On)
      .on('get', this.getAC.bind(this))
      .on('set', this.setAC.bind(this));

    this.service.setCharacteristic(Characteristic.On, false)

    setInterval(function() {

      this.getAC(function(err, temp) {
        if (err) {temp = err;}
        this.service.getCharacteristic(Characteristic.On).updateValue(temp);
      }.bind(this));

    }.bind(this), defaultJSON.refreshHC * 1000);

    setTimeout(function() {
      this.enablesetAC = true;
      }.bind(this), 500);

    return [this.informationService, this.service];
  }
}