var mongoose = require('mongoose');
var express = require('express');
var bodyParser = require('body-parser');
var webTorrent = require('webtorrent');
var parseTorrent = require('parse-torrent');
var archiver = require('archiver');
var fs = require('fs');
var path = require('path');

//
// Data Base
//

mongoose.connect('mongodb://localhost/alfrid');

var torrentSchema = new mongoose.Schema({
	uri: { type: String, unique: true, required: true },
	name: String,
});
var torrentModel = mongoose.model('torrents', torrentSchema);


//
// Torrent Client
//

var torrentClient = new webTorrent();

torrentModel.find({}, function (err, torrentDBs) {
	if (err) return console.log(err);
	for (var torrentDB of torrentDBs) {
		torrentClient.add(torrentDB.uri);
	}
});


//
// HTTP Server
//

var app = express();
app.use(express.static('public'));
app.use(express.static('node_modules/vue/dist'));
app.use(express.static('node_modules/vue-resource/dist'));
app.use(express.static('node_modules/normalize.css'));
app.use(express.static('node_modules/font-awesome'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// API
app.get('/api/torrents', function (req, res) {

	var torrentsData = [];

	for (var torrent of torrentClient.torrents) {

		var filesData = [];
		var totalSize = 0;

		for (var file of torrent.files) {
			var size = file.length.toFixed(0);
			totalSize += size;
			filesData.push({
				name: file.name,
				size: size
			});
		}
		torrentsData.push({
			uri: torrent.magnetURI,
			hash: torrent.infoHash,
			name: torrent.name,
			size: totalSize, // bytes
			percentage: torrent.progress.toFixed(2) * 100, // %
			time: (torrent.timeRemaining / 1000).toFixed(0), // seconds
			down: torrent.downloadSpeed.toFixed(0),
			up: torrent.uploadSpeed.toFixed(0),
			ratio: torrent.ratio.toFixed(2),
			files: filesData
		});
	}
	res.send(torrentsData);
});
app.post('/api/torrents', function (req, res) {
	torrentClient.add(req.body.uri, {path: __dirname + '/Files'}, function (torrent) {
		var torrentDB = new torrentModel({uri: torrent.magnetURI, name: torrent.name});
		torrentDB.save();
	});
});
app.delete('/api/torrents', function (req, res) {
	torrentClient.remove(req.body.hash);
	torrentModel.remove({uri: req.body.uri}).exec();
});
app.get('/api/download', function (req, res) {

	var torrent = torrentClient.get(req.query.torrentId);
	if (!torrent) {
		console.log("torrent not found");
		res.status(500).end();
	}

	console.log("archiving...");
	var archive = archiver('zip');

	res.attachment("lapin.zip");

	archive.on('error', function(err) {
		console.log(err.message);
		res.status(500).end();
	});
	archive.on('end', function() {
		res.download(__dirname + "/index.js");
		console.log("fini");
	});
	archive.pipe(fs.createWriteStream(__dirname + "/test.zip"));

	// for (var file of torrent.files) {
	// 	archive.file(__dirname+"/Files/"+file.path, { name: file.name });
	// }
	archive.file(__dirname + '/index.js');
	archive.finalize();
});

app.listen(3000);
