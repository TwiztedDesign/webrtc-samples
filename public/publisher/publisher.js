'use strict';

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target') || "target";
const room = urlParams.get('room') || "room";
// let signalingServer = 'https://rtc.medialooks.com:8889';
// let signalingServer = 'https://rtc.videoflow.io';
// let signalingServer = 'https://simple-signal.herokuapp.com';
let signalingServer = 'localhost:8889';

let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;
let turnReady;

let pcConfig = {
	'iceServers': [{
		'urls': 'stun:stun.l.google.com:19302'
	},{
		username: 'user',
		credential: 'pass',
		urls: 'turn:54.198.120.75:3478'
	}]
};

// Set up audio and video regardless of what devices are present.
let sdpConstraints = {
	'mandatory': {
		'OfferToReceiveAudio': true,
		'OfferToReceiveVideo': true
	}
};

/////////////////////////////////////////////

// let room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

let socket = io.connect(signalingServer);

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
		let candidate = new RTCIceCandidate({
			sdpMLineIndex: message.label,
			candidate: message.candidate
		});
		pc.addIceCandidate(candidate);
	} else if (message === 'bye' && isStarted) {
		handleRemoteHangup();
	}
});

////////////////////////////////////////////////////

let localVideo = document.querySelector('#localvid');
let remoteVideo = document.querySelector('#remoteVideo');

navigator.mediaDevices.getUserMedia({
	audio: true,
	video: true
})
	.then(gotStream)
	.catch(function(e) {
		alert('getUserMedia() error: ' + e.name);
	});

function gotStream(stream) {
	console.log('Adding local stream.');
	localStream = stream;
	localVideo.srcObject = stream;
	sendMessage('got user media');
	if (isInitiator) {
		maybeStart();
	}
}

let constraints = {
	video: true
};

console.log('Getting user media with constraints', constraints);

// if (location.hostname !== 'localhost') {
	requestTurn(
		'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
	);
// }

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
	let turnExists = false;
	for (let i in pcConfig.iceServers) {
		if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
			turnExists = true;
			turnReady = true;
			break;
		}
	}
	if (!turnExists) {
		console.log('Getting TURN server from ', turnURL);
		// No TURN server. Get one from computeengineondemand.appspot.com:
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4 && xhr.status === 200) {
				let turnServer = JSON.parse(xhr.responseText);
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
	let videoEl = attacheStream(event.stream);
	document.getElementById('videos').appendChild(videoEl);
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
	isInitiator = false;
}

function stop() {
	isStarted = false;
	pc.close();
	pc = null;
}

function attacheStream(stream, el, options) {
	let item;
	let URL = window.URL;
	let element = el;
	let opts = {
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
			let styleName = prefix ? prefix + 'Transform' : 'transform';
			element.style[styleName] = 'scaleX(-1)';
		});
	}

	element.srcObject = stream;
	return element;
};

//Control handlers
$(document).ready(function () {
	// $('#link').attr('value', 'https://rtc.medialooks.com:8889/Room' + Math.trunc(Math.random() * 10000) + '/WebStreamer' + Math.trunc(Math.random() * 10000));
	$('#link').attr('value',`${signalingServer}/${room}/${targetId}`);
	$('#start').click(function () {
		let res = $('#link').val().split("/");
		if (res.length >= 5) {
			if (res[0] + '//' + res[2] != signalingServer) {
				signalingServer = res[0] + '//' + res[2];
				webrtc = new SimpleWebRTC({
					url: signalingServer,
					stunServer: 'stun:stun.l.google.com:19302',
					localVideoEl: 'localvid',
					remoteVideosEl: '',
					autoRequestMedia: true,
					debug: false,
					detectSpeakingEvents: true,
					autoAdjustMic: false
				})
			}

			let peerInfo = {
				nickName: res[4],
				vidEncoder: $('#vidEncoder').val(),
				vidBitrate: $('#vidBitrate').val(),
				audEncoder: $('#audEncoder').val(),
				audBitrate: $('#audBitrate').val(),
				strongId: webrtc.connection.connection.id,
				mode: 'sender'
			};
			webrtc.setInfo(peerInfo); // Store strongId

			if (res[3]) {
				webrtc.joinRoom(res[3]);
				$('#ConnectStatus').attr('data-state', 'enabled');
			}
		}
	});

	$('#stop').click(function () {
		webrtc.leaveRoom();
		$('#ConnectStatus').attr('data-state', 'disabled');
	});

	$('#mute').click(function () {
		if ($('#mute').attr('data-state') == 'mute') {
			$('#mute').attr('data-state', 'unmute');
			let lvid = document.getElementById('localvid');
			if (lvid) lvid.muted = true;
		}
		else {
			$('#mute').attr('data-state', 'mute')
			if (videoEl) videoEl.muted = false;
		}
	});

	$('#message').keypress(function (e) {
		if ((e.which || e.keyCode) === 13 && $('#message').val())
			webrtc.sendDataChannelMessageToPeer(targetId, $('#message').val());
	});

	$('#sendmessage').click(function () {
		if ($('#message').val())
			webrtc.sendDataChannelMessageToPeer(targetId, $('#message').val());
	});
	$('#fs').click(function () {
		let videoEl = document.getElementById('localvid');
		let rfs = videoEl.requestFullscreen
			|| videoEl.webkitRequestFullScreen
			|| videoEl.mozRequestFullScreen
			|| videoEl.msRequestFullscreen;

		rfs.call(videoEl);
	});
});

