require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

MiAirPurifier3 = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });

    this.accessories = {};
    if(!this.config['airPurifierDisable'] && this.config['airPurifierName'] && this.config['airPurifierName'] != "" && this.config['silentModeSwitchName'] && this.config['silentModeSwitchName'] != "") {
        this.accessories['airPurifierAccessory'] = new MiAirPurifier3AirPurifierAccessory(this);
    }
    if(!this.config['temperatureDisable'] && this.config['temperatureName'] && this.config['temperatureName'] != "") {
        this.accessories['temperatureAccessory'] = new MiAirPurifier3TemperatureAccessory(this);
    }
    if(!this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new MiAirPurifier3HumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new MiAirPurifier3BuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new MiAirPurifier3LEDBulbAccessory(this);
    }
    if(!this.config['airQualityDisable'] && this.config['airQualityName'] && this.config['airQualityName'] != "") {
        this.accessories['airQualityAccessory'] = new MiAirPurifier3AirQualityAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiAirPurifierPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(MiAirPurifier3, Base);

MiAirPurifier3AirPurifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airPurifierName'];
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
    this.frm = [0,5,10,15,20,25,30,40,50,60,70,80,90,95,100];
    this.did = dThis.config['did'];
}

MiAirPurifier3AirPurifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName);
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(!this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }
    
    var airPurifierService = new Service.AirPurifier(this.name);
    var activeCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    var currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    var targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    var lockPhysicalControlsCharacteristic = airPurifierService.addCharacteristic(Characteristic.LockPhysicalControls);
    var rotationSpeedCharacteristic = airPurifierService.addCharacteristic(Characteristic.RotationSpeed);
    
    var currentTemperatureCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentTemperature);
	var currentRelativeHumidityCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    var pm25DensityCharacteristic = airPurifierService.addCharacteristic(Characteristic.PM2_5Density);
    var airQualityCharacteristic = airPurifierService.addCharacteristic(Characteristic.AirQuality);
    services.push(airPurifierService);
    
    silentModeOnCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":2,"piid":5}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - getOn: " + result);
                
                if(result[0]['value'] === 1) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - getOn Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - setOn: " + value);
            if(value) {
                that.device.call("set_properties", [{"did":that.did,"siid":2,"piid":5,"value":1}]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                    if(result[0]['code'] === 0) {
                        targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.AUTO);
                        callback(null);
                        
                        if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                            activeCharacteristic.updateValue(Characteristic.Active.ACTIVE);
                            currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        }
                    } else {
                        callback(new Error(result[0]['code']));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                    callback(err);
                });
            } else {
                if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                    callback(null);
                } else {
                    that.device.call("set_properties", [{"did":that.did,"siid":2,"piid":5,"value": Characteristic.TargetAirPurifierState.AUTO == targetAirPurifierStateCharacteristic.value ? 0 : 2}]).then(result => {
                        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                        if(result[0]['code'] === 0) {
                            callback(null);
                        } else {
                            callback(new Error(result[0]['code']));
                        }
                    }).catch(function(err) {
                        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                        callback(err);
                    });
                }
            }
        }.bind(this));
    
    activeCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":2,"piid":2}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - Active - getActive: " + result);
                
                if(result[0]['value'] === false) {
                    callback(null, Characteristic.Active.INACTIVE);
                } else {
                    callback(null, Characteristic.Active.ACTIVE);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - Active - getActive Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - Active - setActive: " + value);
            that.device.call("set_properties", [{"did":that.did,"siid":2,"piid":2,"value": value ? true : false }]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - Active - setActive Result: " + result);
                if(result[0]['code'] === 0) {
                    currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.IDLE);
                    callback(null);
                    if(value) {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        that.device.call("get_properties", [{"did":that.did,"siid":2,"piid":5}]).then(result => {
                            if(result[0]['value'] === 1) {
                                silentModeOnCharacteristic.updateValue(true);
                            } else {
                                silentModeOnCharacteristic.updateValue(false);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]AirPurifier3AirPurifierAccessory - Active - setActive Error: " + err);
                            callback(err);
                        });
                    } else {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.INACTIVE);
                        silentModeOnCharacteristic.updateValue(false);
                    }
                } else {
                    callback(new Error(result[0]['code']));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - Active - setActive Error: " + err);
                callback(err);
            });
        }.bind(this));
       
    currentAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":2,"piid":2}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState: " + result);
                
                if(result[0]['value'] === false) {
                    callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
                } else {
                    callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    lockPhysicalControlsCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":7,"piid":1}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls: " + result);
                callback(null, result[0]['value'] === true ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_properties", [{"did":that.did,"siid":7,"piid":1,"value": value ? true : false }]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Result: " + result);
                if(result[0]['code'] === 0) {
                    callback(null);
                } else {
                    callback(new Error(result[0]['code']));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this));
        
    targetAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":2,"piid":5}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + result);
                
                if(result[0]['value'] === 2) {
                    callback(null, Characteristic.TargetAirPurifierState.MANUAL);
                } else {
                    callback(null, Characteristic.TargetAirPurifierState.AUTO);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState: " + value);
            that.device.call("set_properties", [{"did":that.did,"siid":2,"piid":5,"value": Characteristic.TargetAirPurifierState.AUTO == value ? (silentModeOnCharacteristic.value ? 1 : 0) : 2 }]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Result: " + result);
                if(result[0]['code'] === 0) {
                    if(Characteristic.TargetAirPurifierState.AUTO == value) {
                        callback(null);
                    } else {
                        that.device.call("get_properties", [{"did":that.did,"siid":10,"piid":10}]).then(result => {
                            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            if(rotationSpeedCharacteristic.value <= result[0]['value'] * 10 && rotationSpeedCharacteristic.value > (result[0]['value'] - 1) * 10) {
                                callback(null);
                            } else {
                                rotationSpeedCharacteristic.value = result[0]['value'] * 10;
                                callback(null);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                            callback(err);
                        });
                    }
                } else {
                    callback(new Error(result[0]['code']));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));
    
    rotationSpeedCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":10,"piid":10}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - RotationSpeed - getRotationSpeed: " + result);
                callback(null, that.getRotationSpeedByFavoriteLevel(parseInt(result[0]['value']), rotationSpeedCharacteristic.value));
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - RotationSpeed - getRotationSpeed Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - RotationSpeed - setRotationSpeed set: " + value);
            if(value == 0) {
                callback(null);
            } else {
                that.device.call("set_properties", [{"did":that.did,"siid":10,"piid":10,"value": that.getFavoriteLevelByRotationSpeed(value) }]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - RotationSpeed - setRotationSpeed Result: " + result);
                    if(result[0]['code'] === 0) {
//                      that.device.call("set_mode", ["favorite"]).then(result => {
//                          that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Result: " + result);
//                          if(result[0] === "ok") {
//                              targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.MANUAL);
//                              silentModeOnCharacteristic.updateValue(false);
                                callback(null);
//                          } else {
//                              callback(new Error(result[0]));
//                          }
//                      }).catch(function(err) {
//                          that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Error: " + err);
//                          callback(err);
//                      });
                    } else {
                        callback(new Error(result[0]['code']));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                    callback(err);
                })
            }
        }.bind(this));

    currentTemperatureCharacteristic.on('get', function(callback) {
        that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":8}]).then(result => {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - Temperature - getTemperature: " + result);
            callback(null, result[0]['value']);
        }).catch(function(err) {
            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - Temperature - getTemperature Error: " + err);
            callback(err);
        });
    }.bind(this));

    currentRelativeHumidityCharacteristic
	    .on('get', function(callback) {
			that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":7}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - Humidity - getHumidity: " + result);
                callback(null, result[0]['value']);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - Humidity - getHumidity Error: " + err);
                callback(err);
            });
	    }.bind(this));

    pm25DensityCharacteristic
	    .on('get', function(callback) {
			that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":6}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - aqi - getHumidity: " + result);
                callback(null, result[0]['value']);
                
                var airQualityValue = Characteristic.AirQuality.UNKNOWN;
                if(result[0]['value'] <= 50) {
                    airQualityValue = Characteristic.AirQuality.EXCELLENT;
                } else if(result[0]['value'] > 50 && result[0]['value'] <= 100) {
                    airQualityValue = Characteristic.AirQuality.GOOD;
                } else if(result[0]['value'] > 100 && result[0]['value'] <= 200) {
                    airQualityValue = Characteristic.AirQuality.FAIR;
                } else if(result[0]['value'] > 200 && result[0]['value'] <= 300) {
                    airQualityValue = Characteristic.AirQuality.INFERIOR;
                } else if(result[0]['value'] > 300) {
                    airQualityValue = Characteristic.AirQuality.POOR;
                } else {
                    airQualityValue = Characteristic.AirQuality.UNKNOWN;
                }
                airQualityCharacteristic.updateValue(airQualityValue);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - aqi - getHumidity Error: " + err);
                callback(err);
            });
	    }.bind(this));

    // var filterMaintenanceService = new Service.FilterMaintenance(this.name);
    var filterChangeIndicationCharacteristic = airPurifierService.getCharacteristic(Characteristic.FilterChangeIndication);
    var filterLifeLevelCharacteristic = airPurifierService.addCharacteristic(Characteristic.FilterLifeLevel);

    filterChangeIndicationCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":4,"piid":3}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication: " + result);
                callback(null, result[0]['value'] < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication Error: " + err);
                callback(err);
            });
        }.bind(this));
    filterLifeLevelCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":4,"piid":3}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel: " + result);
                callback(null, result[0]['value']);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel Error: " + err);
                callback(err);
            });
        }.bind(this));
    // services.push(filterMaintenanceService);

    return services;
}

MiAirPurifier3AirPurifierAccessory.prototype.getFavoriteLevelByRotationSpeed = function(rotationSpeed) {
    if(this.frm.length < 2) {
        return 1;
    }
    
    for(var i = 1; i< this.frm.length; i++) {
        if(rotationSpeed > this.frm[i-1] && rotationSpeed <= this.frm[i]) {
            return i;
        }
    }
    
    return 1;
}

MiAirPurifier3AirPurifierAccessory.prototype.getRotationSpeedByFavoriteLevel = function(favoriteLevel, rotationSpeed) {
    if(this.frm.length < 2) {
        return 1;
    }
    
    if(rotationSpeed > this.frm[favoriteLevel-1] && rotationSpeed <= this.frm[favoriteLevel]) {
        return rotationSpeed;
    } else {
        return this.frm[favoriteLevel];
    }

}

MiAirPurifier3TemperatureAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['temperatureName'];
    this.platform = dThis.platform;
    this.did = dThis.config['did'];
}

MiAirPurifier3TemperatureAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var temperatureService = new Service.TemperatureSensor(this.name);
    temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this))
    services.push(temperatureService);
    
    return services;
}

MiAirPurifier3TemperatureAccessory.prototype.getTemperature = function(callback) {
    var that = this;
    that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":8}]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3TemperatureAccessory - Temperature - getTemperature: " + result);
        callback(null, result[0]['value']);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3TemperatureAccessory - Temperature - getTemperature Error: " + err);
        callback(err);
    });
}

MiAirPurifier3HumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
    this.did = dThis.config['did'];
}

MiAirPurifier3HumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

MiAirPurifier3HumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":7}]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3HumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]['value']);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3HumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}

MiAirPurifier3BuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
    this.did = dThis.config['did'];
}

MiAirPurifier3BuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchService = new Service.Switch(this.name);
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getBuzzerState.bind(this))
        .on('set', this.setBuzzerState.bind(this));
    services.push(switchService);

    return services;
}

MiAirPurifier3BuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    that.device.call("get_properties", [{"did":that.did,"siid":5,"piid":1}]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3BuzzerSwitchAccessory - Mute - getBuzzerState: " + result);
        callback(null, result[0]['value'] === true ? true : false);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3BuzzerSwitchAccessory - Mute - getBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifier3BuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3BuzzerSwitchAccessory - Mute - setBuzzerState: " + value);
    that.device.call("set_properties", [{"did":that.did,"siid":5,"piid":1,"value": value ? true : false }]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3BuzzerSwitchAccessory - Mute - setBuzzerState Result: " + result);
        if(result[0]['code'] === 0) {
            callback(null);
        } else {
            callback(new Error(result[0]['code']));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3BuzzerSwitchAccessory - Mute - setBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifier3LEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
    this.did = dThis.config['did'];
}

MiAirPurifier3LEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    
    onCharacteristic
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":6,"piid":1}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3LEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, result[0]['value'] === 0 ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3LEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3LEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            that.device.call("set_properties", [{"did":that.did,"siid":6,"piid":1,"value": value ? 0 : 2 }]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3LEDBulbAccessory - switchLED - setLEDPower Result: " + result);
                if(result[0]['code'] === 0) {
                    callback(null);
                } else {
                    callback(new Error(result[0]['code']));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3LEDBulbAccessory - switchLED - setLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(switchLEDService);

    return services;
}

MiAirPurifier3AirQualityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airQualityName'];
    this.platform = dThis.platform;
    this.did = dThis.config['did'];
}

MiAirPurifier3AirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];
    
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier3")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var pmService = new Service.AirQualitySensor(this.name);
    var pm2_5Characteristic = pmService.addCharacteristic(Characteristic.PM2_5Density);
    pmService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', function(callback) {
            that.device.call("get_properties", [{"did":that.did,"siid":3,"piid":6}]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier3AirQualityAccessory - AirQuality - getAirQuality: " + result);
                
                pm2_5Characteristic.updateValue(result[0]['value']);
                
                if(result[0]['value'] <= 50) {
                    callback(null, Characteristic.AirQuality.EXCELLENT);
                } else if(result[0]['value'] > 50 && result[0]['value'] <= 100) {
                    callback(null, Characteristic.AirQuality.GOOD);
                } else if(result[0]['value'] > 100 && result[0]['value'] <= 200) {
                    callback(null, Characteristic.AirQuality.FAIR);
                } else if(result[0]['value'] > 200 && result[0]['value'] <= 300) {
                    callback(null, Characteristic.AirQuality.INFERIOR);
                } else if(result[0]['value'] > 300) {
                    callback(null, Characteristic.AirQuality.POOR);
                } else {
                    callback(null, Characteristic.AirQuality.UNKNOWN);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier3AirQualityAccessory - AirQuality - getAirQuality Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(pmService);

    return services;
}