
const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');

const config = require('../config.json');

const app = express();
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.use(bodyParser.json());
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

const ips = [];
const get_ip = (req) => req.headers['x-forwarded-for'] || req.connection.remoteAddress;
const check_ip = (ip) => {
	for(let i=0; i<ips.length; i++) {
		if(ips[i].ip == ip) {
			if(new Date().getTime() - ips[i].time  < config.cool_time) {
				return ips[i].time;
			} else {
				return null;
			}
		}
	}
	return null;
};
const record_ip = (ip) => {
	for(let i=0; i<ips.length; i++) {
		if(ips[i].ip == ip) {
			ips[i].time = new Date().getTime();
			return;
		}
	}
	ips.push({
		ip: ip,
		time: new Date().getTime(),
	});
}

const call_wallet_owner = (method, url, params) => {
	return new Promise((resolve, reject) => {
		request({
			url: config.grin_api.wallet_owner+'/v1/wallet/owner/'+url,
			method: method,
			json: params,
			auth: {
				user: 'grin',
				password: config.grin_api.password,
			},
		}, (error, response, body) => {
			if(error) {
				reject(error);
				return;
			}
			if(response.statusCode != 200) {
				console.log('E: failed to call wallet owner API:', body);
				reject(body);
				return;
			}
			try {
				const json = JSON.parse(body);
				resolve(json[1]);
			} catch(e) {
				resolve(body);
			}
		});
	});
}

app.get(config.server.prefix+'/summary', (req, res) => {
	call_wallet_owner('get', 'retrieve_summary_info').then((json) => {
		json.give_rate = config.give_rate;
		const last_receive = check_ip(get_ip(req));
		json.cool_time_end = (last_receive ? last_receive+config.cool_time : -1);
		res.json(json).end();
	}).catch(() => {
		res.status(500).end();
	});
});

app.post(config.server.prefix+'/send', (req, res) => {
	if(!req.body.method) {
		res.status(400).end();
		return;
	}
	if((req.body.method!='http') && (req.body.method!='file')) {
		res.status(400).end();
		return;
	}
	if(req.body.method=='http' && !req.body.dest) {
		res.status(400).end();
		return;
	}
	if(req.body.method == 'http') {
		if(check_ip(get_ip(req))) {
			res.status(400).send('Cooling...').end();
			return;
		}
	}
	call_wallet_owner('get', 'retrieve_summary_info').then((json) => {
		call_wallet_owner('post', 'issue_send_tx', {
			amount: Math.floor(json.total / 100 * config.give_rate),
			minimum_confirmations: 0,
			method: req.body.method,
			dest: (req.body.method=='http' ? req.body.dest : '/tmp/tx_slate.json'),
			max_outputs: 999,
			num_change_outputs: 1,
			selection_strategy_is_use_all: true,
		}).then((json) => {
			if(req.body.method == 'http') {
				record_ip(get_ip(req));
				res.end();
			} else {
				res.json(json).end();
			}
		}).catch(() => {
			res.status(500).end();
		});
	}).catch(() => {
		res.status(500).end();
	});
});

app.post(config.server.prefix+'/finalize', (req, res) => {
	if(check_ip(get_ip(req))) {
		res.status(400).send('Cooling...').end();
	}
	call_wallet_owner('post', 'finalize_tx', req.body).then((json) => {
		record_ip(get_ip(req));
		res.json(json).end();
	}).catch((e) => {
		res.status(400).json(e).end();
	});
});

app.listen(config.server.port, (config.server.host||'localhost'), () => {
	console.log(`I: server is now listening on http://${config.server.host}:${config.server.port}${config.server.prefix}`);
});

