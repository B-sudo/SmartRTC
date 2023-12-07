const serverURL = 'ws://localhost:8080';

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomNumberInput = document.getElementById("roomNumberInput");
const roomNumberText = document.getElementById("roomNumberDisplay");
const invalidInfo = document.getElementById("invalidInfo");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const activeUsersList = document.getElementById("activeUsersList"); // Assuming you have an element for the user list
const sendMessageButton = document.getElementById("sendMessageButton");
const messageInput = document.getElementById("messageInput");
const messageBox = document.getElementById("messageBox");
const chatSection = document.getElementById("chatSection");
const text2ImgSection = document.getElementById("text2ImageSection");
const text2ImgImage = document.getElementById("text2imgImage");
const text2ImgButton = document.getElementById("text2imgButton");
const text2ImgInput = document.getElementById("text2imgInput");
const img2ImgButton = document.getElementById("img2imgButton");
const img2ImgInput = document.getElementById("img2imgInput");
const imageDownloadButton = document.getElementById('imageDownloadButton');
const currentUserID = document.getElementById('currentUserID');
const enableVideoButton = document.getElementById('enableVideoButton');
const enableAudioButton = document.getElementById('enableAudioButton');
const chatDownloadButton = document.getElementById('chatDownloadButton');


let roomNumber;
let localStream;
let remoteStream;
const peerConnections = new Map();
let userId; // New: User ID for the current client


/** variable for chat communication with webrtc*/
let dataChannel;

/** variables for performance metric */
let fpsPrevTime;
let bpsPrevTime;
let bpsPrevByteSent;
let fpsPrevFrameCount;
let maxBandwidth;
let localPktSent, remotePktLoss;
let localPktSentOld, remotePktLossOld;
let mbps, fps, bandwidth_mbps, roundTripTime, jitter, pkt_loss_rate;


/** variables for output metric*/
let timePassSinceConnected = 0;
const totalTime = 40;  // 2 mins
const metricArray = []
let currUserNum;

const ws = new WebSocket(serverURL);

ws.addEventListener("open", () => {
    setupLocalMedia();
    console.log('Connected to the signaling server');
});

ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    console.log("A message of Type:", message.type);
    handleSignalingData(message);

    // update client ui if needed
    if (message.type === 'room-created') {
        document.getElementById("roomNumberDisplay").textContent = message.room;
        roomNumber = message.room;
        userId = message.userId; // New: Set the user ID
        //updateActiveUsersList(userId);

        // set user id
        currentUserID.textContent = userId;

        // set ui
        createRoomButton.disabled = true;
        joinRoomButton.disabled = true;
        roomNumberInput.value = roomNumber;
        roomNumberInput.disabled = true;
        createRoomButton.classList.add('video-audio-disable');
        joinRoomButton.classList.add('video-audio-disable');

        // enable room elements
        chatSection.classList.remove("chat-section-hidden");
        text2ImgSection.classList.remove("text2image-section-hidden");
    }
    else if (message.type === 'room-joined') {
        roomNumberText.textContent = message.room;
        userId = message.userId; // New: Set the user ID
        //updateActiveUsersList(userId);

        // set user id
        currentUserID.textContent = userId;

        // set ui
        createRoomButton.disabled = true;
        joinRoomButton.disabled = true;
        roomNumberInput.disabled = true;
        invalidInfo.classList.add("invalid-text-hidden");
        createRoomButton.classList.add('video-audio-disable');
        joinRoomButton.classList.add('video-audio-disable');

        // enable room elements
        chatSection.classList.remove("chat-section-hidden");
        text2ImgSection.classList.remove("text2image-section-hidden");
    }
    else if (message.type === 'room-not-found')
    {
        invalidInfo.classList.remove("invalid-text-hidden");
        invalidInfo.textContent = 'Room not found!';
        console.log(`room not found`);
    }
    else if (message.type === 'new-user' || message.type === "offer") {
        //updateActiveUsersList(message.userId);
    }
    else if (message.type === 'get-text') {
        updateChatboxContent(message);
    }
    else if (message.type === 'text2image-rcvd' || message.type === 'img2img-rcvd') {
        updateWhiteBoard(message);
    }
    else if (message.type === 'disable-send-button') {
        text2ImgButton.disabled = true;
        img2ImgButton.disabled = true;
        text2ImgButton.classList.add('video-audio-disable');
        img2ImgButton.classList.add('video-audio-disable');
        text2ImgInput.placeholder = `User-${message.fromUserId} is typing "${message.rcvd_msg}"`;
        img2ImgInput.placeholder = `User-${message.fromUserId} is typing "${message.rcvd_msg}"`;
    }
    else if (message.type === 'enable-send-button') {
        text2ImgButton.disabled = false;
        img2ImgButton.disabled = false;
        text2ImgButton.classList.remove('video-audio-disable');
        img2ImgButton.classList.remove('video-audio-disable');
    }
    else if (message.type === 'user-left')
    {
        updateVideoList(message);
    }
});

ws.addEventListener("close", () => {
    console.log('Disconnected from the signaling server');
});

chatDownloadButton.addEventListener("click", () => {
    const textContent = messageBox.value;

    // Create a Blob containing the content
    var blob = new Blob([textContent], { type: "text/plain" });

    // Create a temporary URL for the Blob
    var url = URL.createObjectURL(blob);

    // Create a link element
    var link = document.createElement("a");

    // Set the link's attributes
    link.href = url;
    link.download = "chat_history.txt";

    // Append the link to the document
    document.body.appendChild(link);

    // Trigger a click event on the link to initiate the download
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
});

enableVideoButton.addEventListener("click", () => {
    if (localStream) {
        const localVideoTrack = localStream.getVideoTracks()[0];
        const enable = localVideoTrack.enabled;
        if (enable)
            enableVideoButton.classList.add('video-audio-disable');
        else
            enableVideoButton.classList.remove('video-audio-disable');
        localVideoTrack.enabled = !localVideoTrack.enabled;
    }

    if (remoteStream)
    {
        const remoteVideoTrack = remoteStream.getVideoTracks()[0];
        remoteVideoTrack.enabled = !remoteVideoTrack.enabled;
    }
});

enableAudioButton.addEventListener("click", () => {
    if (localStream) {
        const localAudioTrack = localStream.getAudioTracks()[0];
        const enable = localAudioTrack.enabled;
        if (enable)
            enableAudioButton.classList.add('video-audio-disable');
        else
            enableAudioButton.classList.remove('video-audio-disable');
        localAudioTrack.enabled = !localAudioTrack.enabled;
    }

    if (remoteStream)
    {
        const remoteAudioTrack = remoteStream.getAudioTracks()[0];
        remoteAudioTrack.enabled = !remoteAudioTrack.enabled;
    }
});

text2ImgButton.addEventListener("click", () => {
    ws.send(JSON.stringify({ type: 'text2image-sent', value: text2ImgInput.value }));

});

img2ImgButton.addEventListener("click", () => {
    ws.send(JSON.stringify({ type: 'img2img-sent', value: img2ImgInput.value }));

});

createRoomButton.addEventListener("click", () => {
    // Send a "create-room" message to the server
    ws.send(JSON.stringify({ type: 'create-room' }));
    //setupLocalMedia();
    //createPeerConnection();
});

joinRoomButton.addEventListener("click", () => {
    // input validation
    const roomnumber = roomNumberInput.value;
    const parsedInt = parseInt(roomnumber, 10);
    if (roomnumber.trim() === '' || isNaN(parsedInt) || !Number.isInteger(parsedInt))
    {
        invalidInfo.classList.remove("invalid-text-hidden");
        invalidInfo.textContent = "Invalid room number!";
        console.log(`invalid room number`);
        return;
    }

    // Disable the "Create Room" button and the "Join Room" button
    /*invalidInfo.classList.add("invalid-text-hidden");
    createRoomButton.disabled = true;
    joinRoomButton.disabled = true;
    roomnumberInput.disabled = true;*/

    // Send a "join" message to the server
    //console.log(`Client joined room ${roomnumber}`);
    ws.send(JSON.stringify({ type: 'join', room: roomnumber }));
    roomNumber = roomnumber;
    //setupLocalMedia();

});

sendMessageButton.addEventListener("click", () => {
    // send the text to server (json: type:'send-text', value:'xxx')
    const msg = messageInput.value;
    const time = new Date();
    ws.send(JSON.stringify({type: 'send-text', value: msg, timestamp: time.toLocaleTimeString()}));

    // update local ui
    messageBox.value += `User ${userId} (${time.toLocaleTimeString()}) - ${msg}\n`;
    messageInput.value = "";
});

imageDownloadButton.addEventListener('click', () => {
    window.open(`/assets/${roomNumber}/images`);
});

function updateVideoList(message) {
    // delete the left user
    const leftUserId = message.userId;
    var videoItem = document.getElementById(`user-video-${leftUserId}`);
    if (videoItem)
    {
        remoteVideo.removeChild(videoItem);
        console.log(`remove video child item ${leftUserId}`);
    }

    // delete the active user list
    var userItem = document.getElementById(`user-item-${leftUserId}`);
    if (userItem)
    {
        activeUsersList.removeChild(userItem);
        console.log(`remove child item ${leftUserId}`);
    }

}

function updateWhiteBoard(message) {
    console.log(message);
    text2ImgImage.src = message.imageUrl;
    
}

// Update the active user list on the client
function updateActiveUsersList(userId) {
    const listItem = document.createElement("li");
    listItem.id = `user-item-${userId}`
    listItem.textContent = `User ${userId}`;
    activeUsersList.appendChild(listItem);
}

function updateChatboxContent(message)
{
    console.log(message);

    //messageBox.value += "User " + message.fromUserId + ": " + message.value + '\n';
    messageBox.value += `User ${message.fromUserId} (${message.timestamp}) - ${message.value}\n`;
}

function createPeerConnection(targetUserId) {
    if (remoteStream && remoteStream.getTracks) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const newPeerConnection = new RTCPeerConnection(configuration);

        remoteStream.getTracks().forEach(track => newPeerConnection.addTrack(track, remoteStream));

        newPeerConnection.onicecandidate = (event) => handleICECandidateEvent(event, targetUserId);
        newPeerConnection.ontrack = (event) => handleTrackEvent(event, targetUserId);

        peerConnections.set(targetUserId, newPeerConnection);

        console.log(`Peer Connection Created with user ${targetUserId}`);
        console.log(remoteStream);
    } else {
        console.error('Local stream is not properly initialized or has no tracks.');
    }
}

function deletePeerConnection(userId)
{
    let peerConnection = peerConnections.get(userId);
    if (peerConnection)
        peerConnection.close();
    peerConnections.delete(userId);
}

/*
function setupLocalMedia() {
    console.log('Requesting local stream');
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
            localStream = stream;
            localVideo.srcObject = stream;
        })
        .catch((error) => {
            console.error('Error accessing the local camera and microphone:', error);
        });
}*/

let remoteVideoTrack;
let remoteAudioTrack;
let localVideoTrack;

async function setupLocalMedia() {
    console.log('Requesting local stream');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      console.log('Received local stream');

      // Save the local video track for later use
      localVideoTrack = stream.getVideoTracks()[0];

      localVideo.srcObject = stream;
      localStream = stream;
      console.log('Local Video Tracks:', localStream.getVideoTracks());

        console.log('Local Video Stream State:', localStream.readyState);
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
    try {
        const remotestream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
        console.log('Received local stream');
  
        // Save the local video track for later use
        remoteVideoTrack = remotestream.getVideoTracks()[0];

        remoteStream = remotestream;
  
        console.log('Local Video Tracks:', localStream.getVideoTracks());
  
          console.log('Local Video Stream State:', localStream.readyState);
      } catch (e) {
        alert(`getUserMedia() error: ${e.name}`);
      }

      if (navigator.connection) {
        const connection = navigator.connection;
        console.log(`Effective connection type: ${connection.effectiveType}`);
        console.log(`Downlink speed: ${connection.downlink} Mbps`);
        console.log(`Downlink speed Max: ${connection.downlinkMax} Mbps`);
        maxBandwidth = connection.downlink * 0.8 * 1000000;
      }
}

// Modify the function to change the resolution dynamically
async function changeVideoResolution(newWidth, newHeight) {
    console.log("changeVideoResolution: ", newWidth, newHeight);
    if (remoteVideoTrack) {
        // Stop the current video track
        remoteVideoTrack.stop();

        // Create a new video track with the desired resolution
        //const newVideoTrack = await navigator.mediaDevices.getUserMedia({
        //    video: {
        //        width: {ideal: newWidth},
        //        height: {ideal: newHeight},
        //    },
        //}).then(mediaStream => mediaStream.getVideoTracks()[0]);

        const isAudioEnable = localStream.getAudioTracks()[0].enabled;
        const remotestream = await navigator.mediaDevices.getUserMedia({audio: true, video: {
            width: {ideal: newWidth},
            height: {ideal: newHeight},
        },});
        console.log('Received local stream');
        remotestream.getAudioTracks()[0].enabled = isAudioEnable;
        // Save the local video track for later use
        remoteVideoTrack = remotestream.getVideoTracks()[0];
        remoteAudioTrack = remotestream.getAudioTracks()[0];

        remoteStream = remotestream;

        // Replace the old track with the new one
        //remoteVideoTrack = newVideoTrack;

        // Replace the track in the peer connection
        for (const [key, peerConnection] of peerConnections.entries()) {
            const videoSender = peerConnection.getSenders().find(sender => sender.track.kind === 'video');
            videoSender.replaceTrack(remoteVideoTrack);
            const audioSender = peerConnection.getSenders().find(sender => sender.track.kind === 'audio');
            audioSender.replaceTrack(remoteAudioTrack);
        }
        // Now, call sendOffer again with the updated resolution information
        //for (const [key, peerConnection] of peerConnections.entries()) {
        //    sendOffer(key);
        //}
    }
}

function handleICECandidateEvent(event, targetUserId) {
    console.log("handleICECandidateEvent", event);
    if (event.candidate) {
        // Send the ICE candidate to the other peers via the signaling server
        const message = JSON.stringify({ type: 'ice-candidate', userId: targetUserId, candidate: event.candidate });
        console.log(`send ice candidate from ${userId} to ${targetUserId}`);
        ws.send(message);
    }
}
let videoTrackProcess = true;

function handleTrackEvent(event, userid) {
    // Add the remote video stream to the UI
    console.log('handleTrackEvent for ' + userid);
    // Iterate through the tracks in the stream
    event.streams.forEach(stream => {
        stream.getTracks().forEach(track => {
            console.log('Received track:', track.kind);
            if (track.kind == "video" && videoTrackProcess) {
                // create container
                const remoteVideoContainer = document.createElement('div');
                remoteVideoContainer.id = `user-video-${userid}`;
                remoteVideoContainer.classList.add('remote-video-container')

                // create video
                const remoteVideoElement = document.createElement('video');
                remoteVideoElement.srcObject = event.streams[0];
                remoteVideoElement.autoplay = true;
                remoteVideoElement.playsinline = true;
                //remoteVideoElement.id = `user-video-${userid}`;
                remoteVideoElement.classList.add('remote-video');

                // create span
                const idSpanElement = document.createElement('span');
                idSpanElement.textContent = userid;
                idSpanElement.classList.add('remote-video-text');

                // add to html
                remoteVideoContainer.appendChild(remoteVideoElement);
                remoteVideoContainer.appendChild(idSpanElement);
                remoteVideo.appendChild(remoteVideoContainer);
                videoTrackProcess = false;
            }
            else if (track.kind == "video" && !videoTrackProcess) {
                videoTrackProcess = true;
            }
        });
    });
}

function handleSignalingData(data) {
    switch (data.type) {
        case 'new-user':
            createPeerConnection(data.userId);
            sendOffer(data.userId);
            break;
        case 'user-left':
            // Handle the case when a user leaves the room
            deletePeerConnection(data.userId);
            break;
        case 'offer':
            // Handle the offer received from another user
            createPeerConnection(data.userId);
            handleOffer(data.offer, data.userId);
            break;
        case 'answer':
            // Handle the answer received from another user
            handleAnswer(data.answer, data.userId);
            break;
        case 'ice-candidate':
            // Handle ICE candidates received from another user
            handleICECandidate(data.candidate, data.userId);
            break;
    }
}

// Modify the sendOffer function to handle resolution changes
function sendOffer(dest) {
    console.log('SendOffer');
    peerConnections.get(dest).createOffer()
        .then((offer) => {
            return peerConnections.get(dest).setLocalDescription(offer);
        })
        .then(() => {
            // Add the resolution information to the offer
            //offer.resolution = {
            //    width: localVideoTrack.getSettings().width,
            //    height: localVideoTrack.getSettings().height,
            //};

            const message = JSON.stringify({type: 'offer', userId: dest, offer: peerConnections.get(dest).localDescription});
            ws.send(message);
            console.log('signaling state after sendOffer:', peerConnections.get(dest).signalingState);
        })
        .catch((error) => {
            console.error('Error creating and sending offer:', error);
        });
}
function handleOffer(offer, dest) {
    console.log('HandleOffer');
    peerConnections.get(dest).setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            console.log('ICE Gathering State (before createAnswer):', peerConnections.get(dest).iceGatheringState);
            return peerConnections.get(dest).createAnswer();
        })
        .then((answer) => {
            console.log('ICE Gathering State (after createAnswer, before setLocalDescription):', peerConnections.get(dest).iceGatheringState);
            return peerConnections.get(dest).setLocalDescription(answer);
        })
        .then(() => {
            sendAnswer();
            /*console.log('ICE Gathering State (after setLocalDescription):', peerConnections.get(dest).iceGatheringState);
            // Check if ICE gathering is complete before sending the answer
            if (peerConnections.get(dest).iceGatheringState === 'complete') {
                sendAnswer();
            } else {
                // Listen for the icegatheringstatechange event
                peerConnections.get(dest).addEventListener('icegatheringstatechange', () => {
                    console.log('ICE Gathering State (change):', peerConnections.get(dest).iceGatheringState);
                    if (peerConnections.get(dest).iceGatheringState === 'complete') {
                        console.log("222");
                        sendAnswer();
                    }
                });
            }*/
        })
        .catch((error) => {
            console.error('Error handling offer:', error);
        });

    function sendAnswer() {
        const message = JSON.stringify({ type: 'answer', userId: dest, answer: peerConnections.get(dest).localDescription });
        ws.send(message);
        console.log('Offer Received, sending answers');
    }
}

function handleAnswer(answer, dest) {
    console.log('HandleAnswer');
    peerConnections.get(dest).setRemoteDescription(new RTCSessionDescription(answer))
            .then(() => {
                console.log('ICE Gathering State:', peerConnections.get(dest).iceGatheringState);
                // If the signaling state is stable, create an offer and send it
                if (peerConnections.get(dest).signalingState === 'stable') {
                    //sendOffer();
                }
            })
            .catch((error) => {
                console.error('Error handling answer:', error);
            });
        console.log('signaling state for handleAnswer:', peerConnections.get(dest).signalingState);
}

function handleICECandidate(candidate, dest) {
    console.log("get remote candidate");
    peerConnections.get(dest).addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
            console.error('Error handling ICE candidate:', error);
        });
}


let sendBandwidthLevel = 5;

function dynamicUpdateResolution(bandwidth) {
    //estimated R = 0.5; 0.6Mbps = 200*200*30
    const ratio = 360.0 / 480.0;

    if (remoteVideo) {
        const activeUsersCount = remoteVideo.childElementCount;
        const bandwidth_partition = bandwidth / activeUsersCount;

        if (bandwidth_partition >= 3750000 * ratio && sendBandwidthLevel != 5) {
            sendBandwidthLevel = 5;
            changeVideoResolution(500, 500 * ratio);
        }
        else if (bandwidth_partition < 3750000 * ratio && bandwidth_partition >= 2400000 * ratio && sendBandwidthLevel != 4) {
            sendBandwidthLevel = 4;
            changeVideoResolution(400, 400 * ratio);
        }
        else if (bandwidth_partition < 2400000 * ratio && bandwidth_partition >= 1350000 * ratio && sendBandwidthLevel != 3) {
            sendBandwidthLevel = 3;
            changeVideoResolution(300, 300 * ratio);
        }
        else if (bandwidth_partition < 1350000 * ratio && bandwidth_partition >= 600000 * ratio && sendBandwidthLevel != 2) {
            sendBandwidthLevel = 2;
            changeVideoResolution(200, 200 * ratio);
        }
        else if (bandwidth_partition < 600000 * ratio && bandwidth_partition >= 150000 * ratio && sendBandwidthLevel != 1) {
            sendBandwidthLevel = 1;
            changeVideoResolution(100, 100 * ratio);
        }
        else if (bandwidth_partition < 150000 * ratio && sendBandwidthLevel != 0) {
            sendBandwidthLevel = 0;
            changeVideoResolution(50, 50 * ratio);
        }
    }
    else {
        console.log("No activeUsersList");
    }

}

/** Networking Performance Metrics sending mbps, sending fps, bandwidth (mbps), latency(rtt),*/

function getNetworkMetrics() {
    if (navigator.connection) {
        const connection = navigator.connection;
        console.log(`Effective connection type: ${connection.effectiveType}`);
        console.log(`Downlink speed: ${connection.downlink} Mbps`);
      }

    dynamicUpdateResolution(maxBandwidth / remoteVideo.childElementCount);


    for (const [key, value] of peerConnections.entries()) {

        timePassSinceConnected++;
        currUserNum = peerConnections.size + 1;

        const videoSender = value.getSenders().find(sender => sender.track.kind === 'video');
        videoSender.getStats().then(stats => {
            stats.forEach(stat => {
                if (stat.type === 'outbound-rtp') {

                    // bitrate (bmps)
                    const currentTime = new Date().getTime();
                    const deltaTime1 = currentTime - bpsPrevTime;
                    const deltaByteSent = stat.bytesSent - bpsPrevByteSent;

                    const bps = (deltaByteSent * 8) / (deltaTime1 / 1000);
                    mbps = bps * 1e-6;

                    console.log('Sending Bitrate:', mbps.toFixed(2), 'mbps');

                    bpsPrevTime = currentTime;
                    bpsPrevByteSent = stat.bytesSent;

                    // framerate (fps)
                    const deltaTime2 = currentTime - fpsPrevTime;
                    const deltaFrameSent = stat.framesSent - fpsPrevFrameCount;

                    fps = deltaFrameSent / (deltaTime2 / 1000);

                    console.log('Sending Video FPS:', fps.toFixed(2));

                    fpsPrevTime = currentTime;
                    fpsPrevFrameCount = stat.framesSent;
                }

                if (stat.type === 'candidate-pair' && stat.nominated) {

                    // bandwidth
                    const bytesSent = parseInt(stat.bytesSent);
                    const bytesReceived = parseInt(stat.bytesReceived);

                    //const bandwidth = (bytesSent + bytesReceived) * 8 / (stat.totalRoundTripTime * 1000);
                    const bandwidth = maxBandwidth / remoteVideo.childElementCount;
                    bandwidth_mbps = bandwidth * 1e-6;
                    console.log('Estimated Bandwidth:', bandwidth_mbps.toFixed(2), 'mbps');


                    // rtt
                    roundTripTime = parseFloat(stat.currentRoundTripTime);
                    console.log('Round-Trip Time:', roundTripTime, 'ms');
                }

                // jitter
                if (stat.type === 'remote-inbound-rtp')
                {
                    jitter = stat.jitter * 1e4;
                    console.log(`Jitter: ${jitter.toFixed(2)} ms`);
                }

            });
        });

        // packet loss rate
        value.getStats()
            .then(stats => {
                stats.forEach(report => {
                    if (report.type === 'remote-inbound-rtp' && report.kind === 'video')
                    {
                        remotePktLossOld = remotePktLoss;
                        remotePktLoss = report.packetsLost;
                        console.log(`Packet Loss: ${remotePktLoss}`);
                    }

                    if (report.type == 'outbound-rtp' && report.kind === 'video')
                    {
                        localPktSentOld = localPktSent;
                        localPktSent = report.packetsSent;
                        console.log(`Packet Sent: ${localPktSent}`);
                    }
                })
            })

        let pkt_loss = (remotePktLoss - remotePktLossOld)/(localPktSent - localPktSentOld);
        if (isNaN(pkt_loss))
            pkt_loss = 0;
        pkt_loss_rate = pkt_loss * 100;
        console.log(`Delta Package Loss: ${pkt_loss_rate.toFixed(2)}%`);

        // output metric data
        const metric_item = {
            fps: fps.toFixed(2),
            pktLoss: pkt_loss_rate.toFixed(2),
            bitRate: mbps.toFixed(2),
            bandwidth: bandwidth_mbps.toFixed(2),
            rtt: roundTripTime,
            jitter: jitter.toFixed(2),
            time: timePassSinceConnected,
            userNum: currUserNum
        };
        metricArray.push(metric_item);

        if (timePassSinceConnected === totalTime)
        {
            console.log('--------------send log-------');
            ws.send(JSON.stringify({ type: 'metric-log', value: metricArray }));
        }

        break;
    }
}

/*
function probeResolution() {
    //estimated R = 0.5; 0.6Mbps = 200*200*30
    
    if (sendBandwidthLevel < 5) {
        sendBandwidthLevel = sendBandwidthLevel + 1;
        changeVideoResolution(sendBandwidthLevel * 100, sendBandwidthLevel * 100);
    }     

}*/

setInterval(getNetworkMetrics, 2000);  // 4000
//setInterval(probeResolution, 9000);
