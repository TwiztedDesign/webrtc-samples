const express       = require('express');
const path          = require('path');
const app           = express();
const port          = 80;
const socketIO      = require('socket.io');


// app.use(express.static('/'));

app.get('/', (req, res) => {
	res.send('Videoflow WebRTC Samples (go to /streamer)');
});

app.get('/streamer', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/streamer.html'));
});
app.get('/publish', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/publisher2/publisher.html'));
});
app.get('/subscribe', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/subscriber/subscriber.html'));
});
app.get('/video', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/videoPublish/video-publish.html'));
});

app.get('/receiver', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/receiver.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
})