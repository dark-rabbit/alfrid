var mongoose = require('mongoose');
var express = require('express');
var bodyParser = require('body-parser');
var webTorrent = require('webtorrent');
var archiver = require('archiver');
var fs = require('fs');

console.log("============");
console.log("|| ALFRID ||");
console.log("============");


//
// Data Base
//

console.log("Connecting to database");
mongoose.connect('mongodb://localhost/alfrid');

var torrentSchema = new mongoose.Schema({
	name: String,
	uri: {type: String, unique: true, required: true},
	active: {type: Boolean, default: true},
	progress: {type: Number, default: 0},
	size: {type: Number, default: 0},
	files: [String],
	ratio: {type: Number, default: 0}
});
var torrentModel = mongoose.model('torrents', torrentSchema);


//
// Torrent Client
//

console.log("Starting torrent client");
var torrentClient = new webTorrent();

console.log("Loading active torrents");
torrentModel.find({}, function (err, torrentDBs) {

	if (err) return console.log(err);

	for (var torrentDB of torrentDBs) {
		if (torrentDB.active) {
			torrentClient.add(
				torrentDB.uri,
				{path: __dirname + '/DATA'}
			);
		}
	}
});


//
// HTTP Server
//

console.log("Starting http server");
var app = express();
app.use(express.static('public'));
app.use('/js', express.static('node_modules/vue/dist'));
app.use('/js', express.static('node_modules/vue-resource/dist'));
app.use('/css', express.static('node_modules/normalize.css'));
app.use(express.static('node_modules/font-awesome'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// GET torrents metatdatas
app.get('/api/torrent', function (req, res) {

	torrentModel.find({}, function (err, torrentDBs) {

		if (err) {
			console.log(err);
			return res.status(404).end();
		}

		var torrentsData = [];

		for (var torrentDB of torrentDBs) {

			if (torrentDB.active) {

				var torrent = torrentClient.get(torrentDB.uri);

				if (torrent) {

					torrentsData.push({
						uri: torrentDB.uri,
						name: torrentDB.name,
						size: torrentDB.size, // bytes
						percentage: (torrent.progress * 100).toFixed(0), // %
						time: torrent.timeRemaining.toFixed(0), // ms
						down: torrent.downloadSpeed.toFixed(0),
						up: torrent.uploadSpeed.toFixed(0),
						ratio: (torrentDB.ratio + torrent.ratio).toFixed(2),
						files: torrentDB.files,
						active: true
					});

				} else {
					torrentDB.active = false;
					torrentDB.save();
				}

			} else {

				torrentsData.push({
					uri: torrentDB.uri,
					name: torrentDB.name,
					size: torrentDB.size, // bytes
					percentage: torrentDB.progress, // %
					time: null,
					down: 0,
					up: 0,
					ratio: torrentDB.ratio,
					files: torrentDB.files,
					active: false
				});
			}
		}
		res.send(torrentsData);
	});
});


// ADD a new torrent
app.post('/api/torrent', function (req, res) {

	console.log(req.ip + " Adding torrent");

	// TODO
	// better uri checking
	if (!req.body.uri) {
		console.log("Invalid torrent uri");
		return res.status(404).end();
	}

	torrentClient.add(req.body.uri, {path: __dirname + '/DATA'}, function (torrent) {
		var totalSize = 0;
		var fileNames = [];
		for (var file of torrent.files) {
			totalSize += file.length;
			fileNames.push(file.name);
		}
		var torrentDB = new torrentModel({
			uri: torrent.magnetURI,
			name: torrent.name,
			size: totalSize.toFixed(0),
			files: fileNames
		});
		torrentDB.save();
		console.log(torrent.name + " added");
	});
});


// STREAM torrent file
app.get('/api/torrent/stream', function (req, res) {

	console.log(req.ip + " Streaming a torrent")
	var torrent = torrentClient.get(req.query.torrentId);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}

	console.log("S")
});


// DOWNLOAD torrent files
app.get('/api/torrent/download', function (req, res) {

	console.log(req.ip + " Downloading torrent files");
	var torrent = torrentClient.get(req.query.torrentId);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}

	console.log("Archiving and sending " + torrent.name);
	var archive = archiver('zip');

	res.attachment(torrent.name + ".zip");

	archive.on('error', function(err) {
		console.log(err.message);
		res.status(500).end();
	});
	archive.on('end', function() {
		console.log(torrent.name + ' archived and sent')
	});

	archive.pipe(res);
	archive.directory(torrent.path + "/" + torrent.name, torrent.name);
	archive.finalize();
});


// TOGGLE a torrent
app.put('/api/torrent/toggle', function (req, res) {

	console.log(req.ip + " Toggle torrent");

	torrentModel.where({uri: req.body.uri}).findOne(function (err, torrentDB) {
		if (err) {
			console.log(err);
			return res.status(500).end();
		}

		if (torrentDB.active) {

			var torrent = torrentClient.get(torrentDB.uri);
			if (torrent) {
				torrentDB.progress = (100 * torrent.progress).toFixed(0);
				torrentDB.ratio += torrent.ratio.toFixed(2);
				torrent.destroy();
			}
			console.log(req.body.name + " desactivated");

		} else {

			torrentClient.add(torrentDB.uri, {path: __dirname + "/DATA"});
			console.log(req.body.name + " activated");
		}

		torrentDB.active = !torrentDB.active;
		torrentDB.save();
	});
});


app.listen(3000);

console.log("===========");
console.log("|| READY ||");
console.log("===========");
