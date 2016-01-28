var torrentList = new Vue({

	el: '#torrent-list',

	data: {
		torrents: [],
		selectedTorrent: null,
		streamingUrl: null
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
		streamTorrent: function(torrent, file) {
			this.streamingUrl = 'http://'+location.host+'/api/torrent/stream?hash='+torrent.hash+'&fileName='+file;
		},
		downloadTorrent: function (torrent) {
			window.location = '/api/torrent/download?hash=' + torrent.hash;
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
	var size = parseInt(bytes);
	var kilo = Math.pow(10, 3);
	var mega = Math.pow(10, 6);
	var giga = Math.pow(10, 9);
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

Vue.filter('time', function (sec) {
	var time = parseInt(sec);
	var min = 60;
	var hour = 60 * min;
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
