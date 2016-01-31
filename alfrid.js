'use strict';

const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const webTorrent = require('webtorrent');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// const
const dataDir = path.join(__dirname, 'DATA');

console.log('============');
console.log('|| ALFRID ||');
console.log('============');


//
// Data Base
//

console.log('Connecting to database');
mongoose.connect('mongodb://localhost/alfrid');

const torrentSchema = new mongoose.Schema({
	name: String,
	uri: {type: String, unique: true, required: true},
	hash: {type: String, unique: true, required: true},
	active: {type: Boolean, default: true},
	progress: {type: Number, default: 0},
	size: {type: Number, default: 0},
	files: [{
		name: String,
		path: String,
		size: Number
	}],
	ratio: {type: Number, default: 0}
});
const torrentModel = mongoose.model('torrents', torrentSchema);

var torrentData = [];


//
// Torrent Client
//

console.log('Starting torrent client');
var torrentClient = new webTorrent();

console.log('Loading torrents');

torrentModel.find({}, (err, torrentDBs) => {

	if (err) return console.log(err);

	for (let torrentDB of torrentDBs) {

		if (torrentDB.active) {

			torrentClient.add(
				torrentDB.uri,
				{path: dataDir}
			);
			torrentData.push({
				uri: torrentDB.uri,
				hash: torrentDB.hash,
				name: torrentDB.name,
				size: torrentDB.size,
				progress: torrentDB.progress,
				time: 0,
				down: 0,
				up: 0,
				ratio: torrentDB.ratio,
				files: torrentDB.files,
				active: torrentDB.active
			});
		}
	}
});


//
// HTTP Server
//

console.log('Starting http server');
var app = express();
app.use(express.static('public'));
app.use('/js', express.static('node_modules/vue/dist'));
app.use('/js', express.static('node_modules/vue-resource/dist'));
app.use('/css', express.static('node_modules/normalize.css'));
app.use(express.static('node_modules/font-awesome'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// GET torrents metadatas
// TODO handle a light weight request
//		Carefull with multiple users
app.get('/api/torrent', (req, res) => {
	for (let data of torrentData) {
		if (data.active) {
			let torrent = torrentClient.get(data.hash);
			if (torrent) {
				if (data.progress < 100) {
					data.progress = Math.round(torrent.progress * 100);	// %
					data.time = Math.round(torrent.timeRemaining / 1000);// sec
					data.down = Math.round(torrent.downloadSpeed);
				}
				data.up = Math.round(torrent.uploadSpeed);
				data.ratio += parseInt(torrent.ratio.toFixed(2));
			}
		}
	}
	res.send(torrentData);
});


// ADD a new torrent
app.post('/api/torrent', (req, res) => {

	console.log(req.ip + ' Adding torrent');

	// TODO
	// better uri checking (valid, already exists ...)
	if (!req.body.uri) {
		console.log('Invalid torrent uri');
		return res.status(404).end();
	}

	torrentClient.add(req.body.uri, {path: dataDir}, (torrent) => {

		let totalSize = 0;
		let files = [];
		for (let file of torrent.files) {
			totalSize += file.length;
			files.push({
				name: file.name,
				path: file.path,
				size: Math.round(file.length)
			});
		}
		torrentData.push({
			uri: torrent.magnetURI,
			hash: torrent.infoHash,
			name: torrent.name,
			size: Math.round(totalSize),
			progress: 0,
			time: 0,
			down: 0,
			up: 0,
			ratio: 0,
			files: files,
			active: true
		});
		res.end();

		let torrentDB = new torrentModel({
			uri: torrent.magnetURI,
			hash: torrent.infoHash,
			name: torrent.name,
			size: Math.round(totalSize),
			files: files
		});
		torrentDB.save();
		console.log(torrent.name + ' added');
	});
});


// STREAM torrent file
// TODO serve the subtitles
// TODO check if the file is streamable
app.get('/api/torrent/stream', (req, res) => {

	console.log(req.ip + ' Streaming a torrent');
	let selectedTorrent = torrentData.find((data) => {
		return data.hash === req.query.hash;
	});
	if (!selectedTorrent) {
		console.log('Torrent not found');
		return res.status(404).end();
	}
	let fileData = selectedTorrent.files.find((data) => {
		return data.name === req.query.fileName;
	});
	if (!fileData) {
		console.log('File not found');
		return res.status(404).end();
	}

	res.attachment(fileData.name);
	if (selectedTorrent.active) {
		let torrent = torrentClient.get(selectedTorrent.hash);
		res.pipe(torrent.files.find((file) => {
			return file.name === fileData.name;
		}).createReadStream());
	} else {
		res.pipe(fs.createReadStream(
			path.join(dataDir, fileData.path)
		));
	}
});


// DOWNLOAD torrent files
app.get('/api/torrent/download', (req, res) => {

	console.log(req.ip + ' Downloading torrent files');
	let torrent = torrentData.find((data) => {
		return data.hash === req.query.hash;
	});
	if (!torrent) {
		console.log('Torrent not found');
		return res.status(404).end();
	}

	console.log('Archiving and sending ' + torrent.name);
	let archive = archiver('zip');

	res.attachment(torrent.name + '.zip');

	archive.on('error', (err) => {
		console.log(err.message);
		res.status(500).end();
	});
	archive.on('end', () => {
		console.log(torrent.name + ' archived and sent');
	});

	archive.pipe(res);
	archive.directory(path.join(dataDir, torrent.name), torrent.name);
	archive.finalize();
});


// TOGGLE a torrent
app.put('/api/torrent/toggle', (req, res) => {

	console.log(req.ip + ' Toggle torrent');

	let data = torrentData.filter((data) => {
		return data.hash === req.query.hash;
	});
	if (!data) {
		return res.satus(404).end;
	}
	if (data.active) {

		let torrent = torrentClient.get(torrent.uri);
		if (torrent) {
			if (data.progress < 100) {
				data.progress = Math.round(torrent.progress * 100);
			}
			data.ratio += parseInt(torrent.ratio.toFixed(2));
			torrent.destroy();
		}
		console.log(req.body.name + ' desactivated');

	} else {

		torrentClient.add(data.uri, {path: dataDir});
		console.log(req.body.name + ' activated');
	}

	data.active = !data.active;
	res.end();

	torrentModel.where({uri: req.body.uri}).findOne((err, torrentDB) => {

		if (err) {
			console.log(err);
			return res.status(500).end();
		}

		torrentDB.progress = data.progress;
		torrentDB.ratio = data.ratio;
		torrentDB.active = data.active;
		torrentDB.save();
	});
});


app.listen(3000);

console.log('===========');
console.log('|| READY ||');
console.log('===========');
