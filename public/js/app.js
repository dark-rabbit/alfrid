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
			this.$http.put('/api/torrent/toggle?hash=' + torrent.hash);
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
		size = size / giga;
		result = size.toFixed(2) + " Gb";
	} else if (size > mega) {
		size = size / mega;
		result = size.toFixed(2) + " Mb";
	} else if (size > kilo) {
		size = size / kilo;
		result = size.toFixed(2) + " Kb";
	} else {
		result = size.toFixed(2) + " b";
	}
	return result;
});

Vue.filter('time', function (sec) {
	var time = parseInt(sec);
	var min = 60;
	var hour = 60 * min;
	var result = "";
	if (time > min) {
		time = time / min;
		result = time.toFixed(0) + " min";
	} else if (time > hour) {
		time = time / hour;
		result = time.toFixed(0) + " h";
	} else {
		result = time.toFixed(0) + " s";
	}
	return result;
});
