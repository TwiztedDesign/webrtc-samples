'use strict';

var isChannelReady = false;
var isInitiator = true;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
	'iceServers': [{
		'urls': 'stun:stun.l.google.com:19302'
	},{
		username: 'user',
		credential: 'pass',
		urls: 'turn:54.198.120.75:3478'
	}]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
	'mandatory': {
		'OfferToReceiveAudio': true,
		'OfferToReceiveVideo': true
	}
};

/////////////////////////////////////////////

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');
// const signalingServer = 'localhost:8889';
const signalingServer = 'https://simple-signal.herokuapp.com';
var socket = io.connect(signalingServer);

if (room !== '') {
	socket.emit('create or join', room);
	console.log('Attempted to create or  join room', room);
}

socket.on('created', function(room) {
	console.log('Created room ' + room);
	isInitiator = true;
});

socket.on('full', function(room) {
	console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
	console.log('Another peer made a request to join room ' + room);
	console.log('This peer is the initiator of room ' + room + '!');
	isChannelReady = true;
});

socket.on('joined', function(room) {
	console.log('joined: ' + room);
	isChannelReady = true;
});

socket.on('log', function(array) {
	console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
	console.log('Client sending message: ', message);
	socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
	console.log('Client received message:', message);
	if (message === 'got user media') {
		maybeStart();
	} else if (message.type === 'offer') {
		if (!isInitiator && !isStarted) {
			maybeStart();
		}
		pc.setRemoteDescription(new RTCSessionDescription(message));
		doAnswer();
	} else if (message.type === 'answer' && isStarted) {
		pc.setRemoteDescription(new RTCSessionDescription(message));
	} else if (message.type === 'candidate' && isStarted) {
		var candidate = new RTCIceCandidate({
			sdpMLineIndex: message.label,
			candidate: message.candidate
		});
		pc.addIceCandidate(candidate);
	} else if (message === 'bye' && isStarted) {
		handleRemoteHangup();
	}
});

////////////////////////////////////////////////////

let localVideo = document.querySelector('#localVideo');
let remoteVideo = document.querySelector('#remoteVideo');
let cam = false;
if(!cam){
	function start(){
		if(localStream){
			return;
		}
		if (localVideo.captureStream) {
			localStream = localVideo.captureStream();
			sendMessage('got user media');
			console.log('Captured stream from leftVideo with captureStream', localStream);
			maybeStart();
		} else if (localVideo.mozCaptureStream) {
			localStream = localVideo.mozCaptureStream();
			console.log('Captured stream from leftVideo with mozCaptureStream()', localStream);
			sendMessage('got user media');
			maybeStart();
		} else {
			console.log('captureStream() not supported');
		}
	}
	setTimeout(start,2000);
	// start();
} else {
	navigator.mediaDevices.getUserMedia({
		audio: true,
		video: true
	})
		.then(gotStream)
		.catch(function(e) {
			alert('getUserMedia() error: ' + e.name);
		});
}



function gotStream(stream) {
	console.log('Adding local stream.');
	localStream = stream;
	localVideo.srcObject = stream;
	sendMessage('got user media');
	if (isInitiator) {
		maybeStart();
	}
}

var constraints = {
	video: true
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
	requestTurn(
		'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
	);
}

function maybeStart() {
	console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
	if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
		console.log('>>>>>> creating peer connection');
		createPeerConnection();
		pc.addStream(localStream);
		isStarted = true;
		console.log('isInitiator', isInitiator);
		if (isInitiator) {
			doCall();
		}
	}
}

window.onbeforeunload = function() {
	sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
	try {
		pc = new RTCPeerConnection(null);
		pc.onicecandidate = handleIceCandidate;
		pc.onaddstream = handleRemoteStreamAdded;
		pc.onremovestream = handleRemoteStreamRemoved;
		console.log('Created RTCPeerConnnection');
	} catch (e) {
		console.log('Failed to create PeerConnection, exception: ' + e.message);
		alert('Cannot create RTCPeerConnection object.');
		return;
	}
}

function handleIceCandidate(event) {
	console.log('icecandidate event: ', event);
	if (event.candidate) {
		sendMessage({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate
		});
	} else {
		console.log('End of candidates.');
	}
}

function handleCreateOfferError(event) {
	console.log('createOffer() error: ', event);
}

function doCall() {
	console.log('Sending offer to peer');
	pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
	console.log('Sending answer to peer.');
	pc.createAnswer().then(
		setLocalAndSendMessage,
		onCreateSessionDescriptionError
	);
}

function setLocalAndSendMessage(sessionDescription) {
	pc.setLocalDescription(sessionDescription);
	console.log('setLocalAndSendMessage sending message', sessionDescription);
	sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
	trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
	var turnExists = false;
	for (var i in pcConfig.iceServers) {
		if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
			turnExists = true;
			turnReady = true;
			break;
		}
	}
	if (!turnExists) {
		console.log('Getting TURN server from ', turnURL);
		// No TURN server. Get one from computeengineondemand.appspot.com:
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4 && xhr.status === 200) {
				var turnServer = JSON.parse(xhr.responseText);
				console.log('Got TURN server: ', turnServer);
				pcConfig.iceServers.push({
					'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
					'credential': turnServer.password
				});
				turnReady = true;
			}
		};
		xhr.open('GET', turnURL, true);
		xhr.send();
	}
}

function handleRemoteStreamAdded(event) {
	console.log('Remote stream added.');
	console.log(event.stream);
	remoteStream = event.stream;
	// let videoEl = attacheStream(event.stream);
	// document.getElementById('videos').appendChild(videoEl);
	remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
	console.log('Remote stream removed. Event: ', event);
}

function hangup() {
	console.log('Hanging up.');
	stop();
	sendMessage('bye');
}

function handleRemoteHangup() {
	console.log('Session terminated.');
	stop();
	// isInitiator = false;
}

function stop() {
	isStarted = false;
	pc.close();
	pc = null;
}

function attacheStream(stream, el, options) {
	var item;
	var URL = window.URL;
	var element = el;
	var opts = {
		autoplay: true,
		mirror: false,
		muted: false,
		audio: false,
		disableContextMenu: false
	};

	if (options) {
		for (item in options) {
			opts[item] = options[item];
		}
	}

	if (!element) {
		element = document.createElement(opts.audio ? 'audio' : 'video');
	} else if (element.tagName.toLowerCase() === 'audio') {
		opts.audio = true;
	}

	if (opts.disableContextMenu) {
		element.oncontextmenu = function (e) {
			e.preventDefault();
		};
	}

	if (opts.autoplay) element.autoplay = 'autoplay';
	if (opts.muted) element.muted = true;
	if (!opts.audio && opts.mirror) {
		['', 'moz', 'webkit', 'o', 'ms'].forEach(function (prefix) {
			var styleName = prefix ? prefix + 'Transform' : 'transform';
			element.style[styleName] = 'scaleX(-1)';
		});
	}

	element.srcObject = stream;
	return element;
};
