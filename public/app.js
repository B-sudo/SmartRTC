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
const imageDownloadButton = document.getElementById('imageDownloadButton');


let roomNumber;
let localStream;
const peerConnections = new Map();
let userId; // New: User ID for the current client


/** variable for chat communication with webrtc*/
let dataChannel;

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
        updateActiveUsersList(userId);

        // enable room elements
        chatSection.classList.remove("chat-section-hidden");
        text2ImgSection.classList.remove("text2image-section-hidden");
    }
    else if (message.type === 'room-joined') {
        roomNumberText.textContent = message.room;
        userId = message.userId; // New: Set the user ID
        updateActiveUsersList(userId);
        createRoomButton.disabled = true;
        joinRoomButton.disabled = true;
        roomNumberInput.disabled = true;
        invalidInfo.classList.add("invalid-text-hidden");

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
        updateActiveUsersList(message.userId);
    }
    else if (message.type === 'get-text') {
        updateChatboxContent(message);
    }
    else if (message.type === 'text2image-rcvd') {
        updateWhiteBoard(message);
    }
    else if (message.type === 'user-left')
    {
        updateVideoList(message);
    }
});

ws.addEventListener("close", () => {
    console.log('Disconnected from the signaling server');
});


text2ImgButton.addEventListener("click", () => {
    // Send a "create-room" message to the server
    ws.send(JSON.stringify({ type: 'text2image-sent', value: text2ImgInput.value }));

});

createRoomButton.addEventListener("click", () => {
    // Send a "create-room" message to the server
    ws.send(JSON.stringify({ type: 'create-room' }));
    createRoomButton.disabled = true;
    joinRoomButton.disabled = true;
    roomNumberInput.disabled = true;
    //setupLocalMedia();
    //createPeerConnection();
});

joinRoomButton.addEventListener("click", () => {
    // input validation
    const roomNumber = roomNumberInput.value;
    const parsedInt = parseInt(roomNumber, 10);
    if (roomNumber.trim() === '' || isNaN(parsedInt) || !Number.isInteger(parsedInt))
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
    roomNumberInput.disabled = true;*/

    // Send a "join" message to the server
    //console.log(`Client joined room ${roomNumber}`);
    ws.send(JSON.stringify({ type: 'join', room: roomNumber }));
    //setupLocalMedia();

});

sendMessageButton.addEventListener("click", () => {
    // send the text to server (json: type:'send-text', value:'xxx')
    const msg = messageInput.value;
    ws.send(JSON.stringify({type: 'send-text', value: msg}));

    // update local ui
    messageBox.value += "User " + userId + ": " + msg + '\n'
    messageInput.value = "";
});

imageDownloadButton.addEventListener('click', () => {
    window.open(`/public/assets/${roomNumber}/images`);
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
    console.log(message)
    text2ImgImage.src = message.imageUrl
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

    messageBox.value += "User " + message.fromUserId + ": " + message.value + '\n';
}

function createPeerConnection(targetUserId) {
    if (localStream && localStream.getTracks) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const newPeerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => newPeerConnection.addTrack(track, localStream));

        newPeerConnection.onicecandidate = (event) => handleICECandidateEvent(event, targetUserId);
        newPeerConnection.ontrack = (event) => handleTrackEvent(event, targetUserId);

        peerConnections.set(targetUserId, newPeerConnection);

        console.log(`Peer Connection Created with user ${targetUserId}`);
        console.log(localStream);
    } else {
        console.error('Local stream is not properly initialized or has no tracks.');
    }
}

function deletePeerConnection(userId)
{
    /*let peerConnection = peerConnections.get(userId);
    if (peerConnection)
        peerConnection.close();*/
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

async function setupLocalMedia() {
    console.log('Requesting local stream');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      console.log('Received local stream');
      localVideo.srcObject = stream;
      localStream = stream;
      console.log('Local Video Tracks:', localStream.getVideoTracks());

        console.log('Local Video Stream State:', localStream.readyState);
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
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
                const remoteVideoElement = document.createElement('video');
                remoteVideoElement.srcObject = event.streams[0];
                remoteVideoElement.autoplay = true;
                remoteVideoElement.playsinline = true;
                remoteVideoElement.id = `user-video-${userid}`;
                remoteVideo.appendChild(remoteVideoElement);
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

function sendOffer(dest) {
    console.log('SendOffer');
    peerConnections.get(dest).createOffer()
        .then((offer) => {
            return peerConnections.get(dest).setLocalDescription(offer);
        })
        .then(() => {
            const message = JSON.stringify({ type: 'offer', userId: dest, offer: peerConnections.get(dest).localDescription });
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
