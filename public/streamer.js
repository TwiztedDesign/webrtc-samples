const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target') || "target";
const room = urlParams.get('room') || "room";
// var signalingServer = 'https://rtc.medialooks.com:8889';
let signalingServer = 'https://rtc.videoflow.io';
// create webrtc connection
var webrtc = new SimpleWebRTC({
	target: targetId,
	url: signalingServer,
	iceServers: [{ url: "stun:stun.l.google.com:19302" }, { username: "user", credential: "root", urls: ["turn:54.242.90.111:3478"] }],
	localVideoEl: 'localvid',
	autoRequestMedia: true,
	debug: false,
	detectSpeakingEvents: true,
	autoAdjustMic: false
});

//Handle message from target peer
webrtc.on('channelMessage', function (peer, label, data) {
	if (data.type == 'custommessage') {
		$('#received').append(data.payload + '\n');
		$('#received').scrollTop($('#received')[0].scrollHeight);
	}
});

//Control handlers
$(document).ready(function () {
	// $('#link').attr('value', 'https://rtc.medialooks.com:8889/Room' + Math.trunc(Math.random() * 10000) + '/WebStreamer' + Math.trunc(Math.random() * 10000));
	$('#link').attr('value',`${signalingServer}/${room}/${targetId}`);
	$('#start').click(function () {
		var res = $('#link').val().split("/");
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

			var peerInfo = {
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
			var lvid = document.getElementById('localvid');
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
		var videoEl = document.getElementById('localvid');
		var rfs = videoEl.requestFullscreen
			|| videoEl.webkitRequestFullScreen
			|| videoEl.mozRequestFullScreen
			|| videoEl.msRequestFullscreen;

		rfs.call(videoEl);
	});
});
