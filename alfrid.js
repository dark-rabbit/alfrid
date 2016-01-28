"use strict";

const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const webTorrent = require('webtorrent');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// const
const dataDir = path.join(__dirname, 'DATA');

console.log("============");
console.log("|| ALFRID ||");
console.log("============");


//
// Data Base
//

console.log("Connecting to database");
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

console.log("Starting torrent client");
var torrentClient = new webTorrent();

console.log("Loading torrents");

torrentModel.find({}, (err, torrentDBs) => {

	if (err) return console.log(err);

	for (let torrentDB of torrentDBs) {

		if (torrentDB.active) {

			torrentClient.add(
				torrentDB.uri,
				{path: dataDir}
			);
			let fileNames = [];
			for (let file of torrentDB.files) {
				fileNames.push(file.name);
			}
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
				files: fileNames,
				active: torrentDB.active
			});
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
					data.time = Math.ceil(torrent.timeRemaining * 1000);// sec
					data.down = Math.round(torrent.downloadSpeed);
				}
				data.up = Math.round(torrent.uploadSpeed);
				data.ratio += Math.round(torrent.ratio * 100) / 100;
			}
		}
	}
	res.send(torrentData);
});


// ADD a new torrent
app.post('/api/torrent', (req, res) => {

	console.log(req.ip + " Adding torrent");

	// TODO
	// better uri checking (valid, already exists ...)
	if (!req.body.uri) {
		console.log("Invalid torrent uri");
		return res.status(404).end();
	}

	torrentClient.add(req.body.uri, {path: dataDir}, (torrent) => {

		let totalSize = 0;
		let files = [];
		let fileNames = [];
		for (let file of torrent.files) {
			totalSize += file.length;
			files.push({
				name: file.name,
				path: file.path,
				size: Math.round(file.length)
			});
			fileNames.push(file.name);
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
			files: fileNames,
			active: true
		});
		let torrentDB = new torrentModel({
			uri: torrent.magnetURI,
			hash: torrent.infoHash,
			name: torrent.name,
			size: Math.round(totalSize),
			files: files
		});
		torrentDB.save();
		console.log(torrent.name + " added");

	});
});


// STREAM torrent file
// TODO handle static case without mongodb or torrentClient
// TODO handle still downloading case with
//			file.createReadStream from torrent object
// TODO serve the subtitles
app.get('/api/torrent/stream', (req, res) => {

	console.log(req.ip + " Streaming a torrent");
	let torrent = torrentClient.get(req.query.hash);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}
	for (let file of torrent.files) {
		if (file.name === req.query.fileName) {
			res.sendFile(path.join(torrent.path, file.path));
		}
	}
});


// DOWNLOAD torrent files
// TODO handle only the static case without mongodb or torrentClient
app.get('/api/torrent/download', (req, res) => {

	console.log(req.ip + " Downloading torrent files");
	let torrent = torrentClient.get(req.query.hash);
	if (!torrent) {
		console.log("Torrent not found");
		return res.status(404).end();
	}

	console.log("Archiving and sending " + torrent.name);
	let archive = archiver('zip');

	res.attachment(torrent.name + ".zip");

	archive.on('error', (err) => {
		console.log(err.message);
		res.status(500).end();
	});
	archive.on('end', () => {
		console.log(torrent.name + ' archived and sent');
	});

	archive.pipe(res);
	archive.directory(path.join(torrent.path, torrent.name), torrent.name);
	archive.finalize();
});


// TOGGLE a torrent
// TODO save to mongo after updating data object then torrentClient
app.put('/api/torrent/toggle', (req, res) => {

	console.log(req.ip + " Toggle torrent");

	torrentModel.where({uri: req.body.uri}).findOne((err, torrentDB) => {

		if (err) {
			console.log(err);
			return res.status(500).end();
		}

		if (torrentDB.active) {

			let torrent = torrentClient.get(torrentDB.uri);
			if (torrent) {
				torrentDB.progress = Math.round(torrent.progress * 100);
				torrentDB.ratio += Math.round(torrent.ratio * 100) / 100;
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
