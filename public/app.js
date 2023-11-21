const serverURL = 'ws://localhost:8080';

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomNumberInput = document.getElementById("roomNumberInput");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const activeUsersList = document.getElementById("activeUsersList"); // Assuming you have an element for the user list

let roomNumber;
let localStream;
const peerConnections = new Map();
let userId; // New: User ID for the current client

const ws = new WebSocket(serverURL);

ws.addEventListener("open", () => {
    setupLocalMedia();
    console.log('Connected to the signaling server');
});

ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    console.log("A message of Type:", message.type);
    handleSignalingData(message);
    if (message.type === 'room-created') {
        document.getElementById("roomNumberDisplay").textContent = message.room;
        userId = message.userId; // New: Set the user ID
        updateActiveUsersList(userId);
    } 
    else if (message.type === 'room-joined') {
        document.getElementById("roomNumberDisplay").textContent = message.room;
        userId = message.userId; // New: Set the user ID
        updateActiveUsersList(userId);
    } else if (message.type === 'new-user' || message.type === "offer") {
        updateActiveUsersList(message.userId);
}
});

ws.addEventListener("close", () => {
    console.log('Disconnected from the signaling server');
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
    // Disable the "Create Room" button and the "Join Room" button
    createRoomButton.disabled = true;
    joinRoomButton.disabled = true;
    roomNumberInput.disabled = true;

    // Use the entered room number to join the room
    const roomNumber = roomNumberInput.value;
    if (roomNumber) {
        // Send a "join" message to the server
        console.log(`Client joined room ${roomNumber}`);
        ws.send(JSON.stringify({ type: 'join', room: roomNumber }));
        setupLocalMedia();
    }
    else {
        console.log(`No room number`);
    }
});

// Update the active user list on the client
function updateActiveUsersList(userId) {
    const listItem = document.createElement("li");
    listItem.textContent = `User ${userId}`;
    activeUsersList.appendChild(listItem);
}

function createPeerConnection(targetUserId) {
    if (localStream && localStream.getTracks) {
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const newPeerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => newPeerConnection.addTrack(track, localStream));

        newPeerConnection.onicecandidate = (event) => handleICECandidateEvent(event, targetUserId);
        newPeerConnection.ontrack = handleTrackEvent;

        peerConnections.set(targetUserId, newPeerConnection);

        console.log(`Peer Connection Created with user ${targetUserId}`);
        console.log(localStream);
    } else {
        console.error('Local stream is not properly initialized or has no tracks.');
    }
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

function handleICECandidateEvent(event) {
    console.log("handleICECandidateEvent", event);
    if (event.candidate) {
        // Send the ICE candidate to the other peers via the signaling server
        const message = JSON.stringify({ type: 'ice-candidate', userId: userId, candidate: event.candidate });
        ws.send(message);
    }
}
let videoTrackProcess = true;

function handleTrackEvent(event) {
    // Add the remote video stream to the UI
    console.log('handleTrackEvent');

    // Iterate through the tracks in the stream
    event.streams.forEach(stream => {
        stream.getTracks().forEach(track => {
            console.log('Received track:', track.kind);
            if (track.kind == "video" && videoTrackProcess) {
                const remoteVideoElement = document.createElement('video');
                remoteVideoElement.srcObject = event.streams[0];
                remoteVideoElement.autoplay = true;
                remoteVideoElement.playsinline = true;
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
            console.log('ICE Gathering State (after setLocalDescription):', peerConnections.get(dest).iceGatheringState);
            // Check if ICE gathering is complete before sending the answer
            if (peerConnections.get(dest).iceGatheringState === 'complete') {
                sendAnswer();
            } else {
                // Listen for the icegatheringstatechange event
                peerConnections.get(dest).addEventListener('icegatheringstatechange', () => {
                    console.log('ICE Gathering State (change):', peerConnections.get(dest).iceGatheringState);
                    if (peerConnections.get(dest).iceGatheringState === 'complete') {
                        sendAnswer();
                    }
                });
            }
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
    console.log('handleICECandidate');
    peerConnections.get(dest).addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
            console.error('Error handling ICE candidate:', error);
        });
}
