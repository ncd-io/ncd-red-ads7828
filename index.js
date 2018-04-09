module.exports = class ADS7828{
	constructor(addr, comm, config){
		if(typeof config != 'object') config = {};
		this.config = Object.assign({
			//PowerDown mode
			powerDown: 3
		}, config);
		this.comm = comm;
		this.addr = addr;
	}

	writeConfig(mux, ret){
		//mux = Multiplexer Settings, should be 0-15
		//See datasheet for value: http://www.ti.com/lit/ds/symlink/ads7828.pdf
		var config = 	(mux << 4) |
						(this.config.PowerDown << 3);

		if(ret) return config;

		var sensor = this;
		return new Promise((fulfill, reject) => {
			sensor.comm.writeByte(this.addr, config).then((res) => {
				sensor.initialized = true;
				fulfill(res);
			}).catch((err) => {
				sensor.initialized = false;
				reject(err);
			})
		});
	}

	get(mux){
		var sensor = this;
		return new Promise((fulfill, reject) => {
			sensor.comm.readBytes(sensor.addr, this.writeConfig(mux, true), 2).then((res) => {
				sensor.initialized = true;
				fulfill((res[0] << 8) | res[1]);
			}).catch((err) => {
				sensor.initialized = false;
				reject(err);
			});
		});
	}

}
