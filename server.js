const express   = require('express');
const path      = require('path');
const app       = express();
const port      = 3000;

app.get('/streamer', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/streamer.html'));
});

app.get('/receiver', (req, res) => {
	res.sendFile(path.join(__dirname + '/public/receiver.html'));
});


app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
})