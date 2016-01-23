var torrentList = new Vue({

	el: '#torrent-list',

	data: {
		torrents: []
	},

	methods: {
		getTorrents: function() {
			this.$http.get('/api/torrent').then(function (res) {
				this.torrents = res.data;
			});
		},
		toggleTorrent: function(torrent) {
			this.$http.put('/api/torrent/toggle', torrent);
		},
		downloadTorrent: function (torrent) {
			window.location = '/api/torrent/download?torrentId=' + torrent.hash;
		}
	},

	ready: this.getTorrents
});
setInterval(torrentList.getTorrents, 5000);

var torrentForm = new Vue({

	el: '#torrent-form',

	data: {
		torrent: {
			uri: ""
		}
	},

	methods: {
		addTorrent: function () {
			this.$http.post('/api/torrent', this.torrent);
		}
	},
});

Vue.filter('size', function (bytes) {
	var kilo = Math.pow(10, 3);
	var mega = Math.pow(10, 6);
	var giga = Math.pow(10, 9);
	var size = parseInt(bytes);
	var result = "";
	if (size > giga) {
		size = (size / giga).toFixed(2);
		result = size + " Gb";
	} else if (size > mega) {
		size = (size / mega).toFixed(2);
		result = size + " Mb";
	} else if (size > kilo) {
		size = (size / kilo).toFixed(2);
		result = size + " Kb";
	} else {
		result = size + " b";
	}
	return result;
});

Vue.filter('time', function (ms) {
	var min = 60;
	var hour = 60 * min;
	var time = (ms * 1000).toFixed(0);
	var result = "";
	if (time > min) {
		time = (time / min).toFixed(0);
		result = time + " min";
	} else if (time > hour) {
		time = (time / hour).toFixed(0);
		result = time + " h";
	} else {
		result = time + " s";
	}
	return result;
});
