var mongoose = require('mongoose');
var express = require('express');
var bodyParser = require('body-parser');
var webTorrent = require('webtorrent');
var admZip = require('adm-zip');
var fs = require('fs');
var path = require('path');

//
// Data Base
//

mongoose.connect('mongodb://localhost/alfrid');

var torrentSchema = new mongoose.Schema({
	url: String,
	name: String
});
var torrentModel = mongoose.model('torrents', torrentSchema);


//
// Torrent Client
//

var torrentClient = new webTorrent();


//
// HTTP Server
//

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Static Files
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/public/index.html');
});
app.get('/style.css', function (req, res) {
	res.sendFile(__dirname + '/public/style.css');
});
app.get('/app.js', function (req, res) {
	res.sendFile(__dirname + '/public/app.js');
});
app.get('/pure-min.css', function (req, res) {
	res.sendFile(__dirname + '/node_modules/purecss/build/pure-min.css');
});
app.get('/font-awesome.min.css', function (req, res) {
	res.sendFile(__dirname + '/node_modules/font-awesome/css/font-awesome.min.css');
});
app.get('/fonts/fontawesome-webfont.ttf', function (req, res) {
	res.sendFile(__dirname + '/node_modules/font-awesome/fonts/fontawesome-webfont.ttf');
});
app.get('/fonts/fontawesome-webfont.woff2', function (req, res) {
	res.sendFile(__dirname + '/node_modules/font-awesome/fonts/fontawesome-webfont.woff2');
});
app.get('/fonts/fontawesome-webfont.woff', function (req, res) {
	res.sendFile(__dirname + '/node_modules/font-awesome/fonts/fontawesome-webfont.woff');
});
app.get('/vue.min.js', function (req, res) {
	res.sendFile(__dirname + '/node_modules/vue/dist/vue.min.js');
});
app.get('/vue-resource.min.js', function (req, res) {
	res.sendFile(__dirname + '/node_modules/vue-resource/dist/vue-resource.min.js');
});
app.get('/alfrid.png', function (req, res) {
	res.sendFile(__dirname + '/public/img/alfrid.png');
});

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
			id: torrent.infoHash,
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
	torrentClient.add(req.body.url, {path: __dirname + '/Files'}, function (torrent) {
		var torrentDB = new torrentModel({url: torrent.magnetURI, name: torrent.name});
		torrentDB.save();
	});
});
app.delete('/api/torrents', function (req, res) {
	torrentClient.remove(req.body.id);
	torrentModel.remove({url: req.body.id}).exec();
});
app.get('/api/download', function (req, res) {
	var torrent = torrentClient.get(req.query.torrentId);
	var zipPath = __dirname + "/Files/tmp/" + torrent.name + ".zip";
	var zip = new admZip();
	// for (var file of torrent.files) {
		// zip.addLocalFile(__dirname + "/Files/" + file.path);
		zip.addLocalFile(__dirname + "index.js");
	// }
	// zip.writeZip(zipPath);
	// res.sendFile(zipPath);
	// fs.unlink(zipPath, function (err) {
	// 	fs.rmdirSync(__dirname + "/Files/tmp");
	// });
});

app.listen(3000);
