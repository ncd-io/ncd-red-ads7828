"use strict";

const ADS7828 = require("./index.js");
const Queue = require("promise-queue");

module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

	function NcdI2cDeviceNode(config){
		RED.nodes.createNode(this, config);
		this.interval = parseInt(config.interval);
		this.addr = parseInt(config.addr);
		if(typeof sensor_pool[this.id] != 'undefined'){
			//Redeployment
			clearTimeout(sensor_pool[this.id].timeout);
			delete(sensor_pool[this.id]);
		}


		var channels = {};
		var channel_count = 0;
		for(var i=1;i<9;i++){
			if(config['channel_'+i] != '_none'){
				channels['channel_'+i] = config['channel_'+i]*1;
				channel_count++;
			}
		}
		this.sensor = new ADS7828(this.addr, RED.nodes.getNode(config.connection).i2c, {powerDown: config.powerDown});

		var node = this;

		function init_sensor(){
			var last_mux;
			for(var i in channels){
				last_mux = channels[i];
			}
			node.sensor.writeConfig(last_mux);
		}


		sensor_pool[this.id] = {
			sensor: this.sensor,
			polling: false,
			timeout: 0,
			node: this
		}

		function device_status(){
			if(!node.sensor.initialized){
				node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}

		var mult = config.output_mult*1;
		function send_payload(_status){
			for(var i in _status) _status[i] *= mult;
			var msg = [],
				dev_status = {topic: 'device_status', payload: _status};
			if(config.output_all){
				for(var i in _status){
					msg.push({topic: i, payload: _status[i]})
				}
				msg.push(dev_status);
			}else{
				msg = dev_status;
			}
			node.send(msg);
		}

		var queue = new Queue(1);

		function get_status(repeat){
			if(repeat) clearTimeout(sensor_pool[node.id].timeout);
			if(device_status(node)){
				var _status = {};
				for(var i in channels){
					queue.add(() => {
						return new Promise((fulfill, reject) => {
							var chnl = i;
							node.sensor.get(channels[chnl]).then((res) => {
								_status[chnl] = res;
								fulfill();
							}).catch(console.log);
						});
					});
				}
				queue.add(() => {
					return new Promise((fulfill, reject) => {
						send_payload(_status);
						fulfill();
						if(repeat && node.interval){
							clearTimeout(sensor_pool[node.id].timeout);
							sensor_pool[node.id].timeout = setTimeout(() => {
								if(typeof sensor_pool[node.id] != 'undefined') get_status(true);
							}, sensor_pool[node.id].node.interval);
						}else{
							sensor_pool[node.id].polling = false;
						}
					});
				})
			}else{
				init_sensor();
				sensor_pool[node.id].timeout = setTimeout(() => {
					if(typeof sensor_pool[node.id] != 'undefined') get_status(true);
				}, 3000);
			}
		}

		if(node.interval && !sensor_pool[node.id].polling){
			sensor_pool[node.id].polling = true;
			get_status(true);
		}

		device_status(node);
		node.on('input', (msg) => {
			if(msg.topic == 'get_status'){
				get_status(false);
			}
		});

		node.on('close', (removed, done) => {
			if(removed){
				clearTimeout(sensor_pool[node.id].timeout);
				delete(sensor_pool[node.id]);
			}
			done();
		});
	}
	RED.nodes.registerType("ncd-ads7828", NcdI2cDeviceNode)
}
