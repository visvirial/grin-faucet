
const API_ENDPOINT = 'https://grin-faucet.visvirial.com/api/v0/';

const send_http = () => {
	const dest = $('#dest').val();
	$.post({
		url: API_ENDPOINT+'send',
		data: {
			method: 'http',
			dest: dest,
		},
		success: () => {
			alert('✅ Transaction successfully sent.');
		},
		error: () => {
			alert('❌ Failed to send transaction.');
		},
	});
};

const send_json = () => {
	$.post({
		url: API_ENDPOINT+'send',
		data: {
			method: 'file',
		},
		success: (json) => {
			$('#tx-slate').val(JSON.stringify(json));
		},
	});
};

const finalize = () => {
	$.post({
		url: API_ENDPOINT+'finalize',
		contentType: 'application/json',
		data: $('#tx-response').val(),
		success: () => {
			alert('✅ Transaction successfully sent.');
		},
		error: () => {
			alert('❌ Failed to send transaction.');
		},
	});
};

$(document).ready(() => {
	$.getJSON(API_ENDPOINT+'summary', (json) => {
		const formatter = Intl.NumberFormat('en-US', {minimumFractionDigits: 9});
		$('#faucet-balance').html(formatter.format(json.total/1e9));
		$('#you-will-get').html(formatter.format(json.total/1e11*json.give_rate));
		if(json.cool_time_end != -1) {
			$('#cool-time-end').html(new Date(json.cool_time_end));
			$('#cool-time-show').show();
		}
	});
});

