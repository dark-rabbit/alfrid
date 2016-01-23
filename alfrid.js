var mongoose = require('mongoose');
var express = require('express');
var bodyParser = require('body-parser');
var webTorrent = require('webtorrent');
var parseTorrent = require('parse-torrent');
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
	uri: { type: String, unique: true, required: true },
	active: {type: Boolean, default: true},
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
			torrentClient.add(torrentDB.uri, {path: __dirname + '/DATA'});
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

	var torrentsData = [];

	for (var torrent of torrentClient.torrents) {

		var filesData = [];
		var totalSize = 0;

		for (var file of torrent.files) {
			var size = file.length;
			totalSize += size;
			filesData.push({
				name: file.name,
				size: size.toFixed(0)
			});
		}
		torrentsData.push({
			uri: torrent.magnetURI,
			hash: torrent.infoHash,
			name: torrent.name,
			size: totalSize.toFixed(0), // bytes
			percentage: (torrent.progress * 100).toFixed(0), // %
			time: (torrent.timeRemaining / 1000).toFixed(0), // seconds
			down: torrent.downloadSpeed.toFixed(0),
			up: torrent.uploadSpeed.toFixed(0),
			ratio: torrent.ratio.toFixed(2),
			files: filesData
		});
	}
	res.send(torrentsData);
});


// ADD a new torrent
app.post('/api/torrent', function (req, res) {

	console.log(req.ip + " Adding torrent");

	if (!req.body.uri) {
		console.log("Invalid torrent uri");
		return res.status(404).end();
	}

	torrentClient.add(req.body.uri, {path: __dirname + '/DATA'}, function (torrent) {
		var torrentDB = new torrentModel({uri: torrent.magnetURI, name: torrent.name});
		torrentDB.save();
		console.log(torrent.name + " added");
	});
});


// DELETE a torrent
app.delete('/api/torrent', function (req, res) {

	console.log(req.ip + " Removing torrent");

	var torrent = torrentClient.get(req.body.hash);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}

	torrent.destroy();
	torrentModel.where({uri: req.body.uri}).findOneAndUpdate({active: false}).exec();
	console.log(req.body.name + " removed");
});


// TOGGLE PAUSE a torrent
app.put('/api/torrent/pause', function (req, res) {

	console.log(req.ip + " Toggle pause torrent");
	var torrent = torrentClient.get(req.body.hash);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}

	torrentModel.where({uri: req.body.uri}).findOne(function (err, torrentDB) {
		if (err) {
			console.log(err);
			return res.status(500).end();
		}
		if (torrentDB.paused) {
			console.log(req.body.name + " resumed");
			torrent.resume();
		} else {
			console.log(req.body.name + " paused");
			torrent.pause();
		}
		torrentDB.paused = !torrentDB.paused;
		torrentDB.save();
	});
});


// DOWNLOAD a torrent's files
app.get('/api/torrent/download', function (req, res) {

	console.log(req.ip + "Downloading torrent files");
	var torrent = torrentClient.get(req.query.torrentId);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}
	if (torrent.progress < 1) {
		console.log("Torrent " + torrent.name + " not ready for archiving");
		return res.status(404).end();
	}

	console.log("Archiving " + torrent.name);
	var archive = archiver('zip');

	res.attachment(torrent.name + ".zip");

	archive.on('error', function(err) {
		console.log(err.message);
		res.status(500).end();
	});
	archive.on('end', function() {
		console.log(torrent.name + " archived and sent");
	});
	archive.pipe(res);

	for (var file of torrent.files) {
		archive.file(__dirname + "/DATA/" + file.path, { name: file.name });
	}

	archive.finalize();
});


app.listen(3000);

console.log("===========");
console.log("|| READY ||");
console.log("===========");

