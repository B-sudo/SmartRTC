const serverURL = 'ws://localhost:8080';

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomNumberInput = document.getElementById("roomNumberInput");
const localVideo = document.getElementById("localVideo");
const remoteVideos = document.getElementById("remoteVideos");

let roomNumber;
let localStream;
let peerConnection;

const ws = new WebSocket(serverURL);

ws.addEventListener("open", () => {
    console.log('Connected to the signaling server');
});

ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleSignalingData(message);
    if (message.type === 'room-created') {
        document.getElementById("roomNumberDisplay").textContent = message.room;
    }
});

ws.addEventListener("close", () => {
    console.log('Disconnected from the signaling server');
});

createRoomButton.addEventListener("click", () => {
    // Send a "create-room" message to the server
    ws.send(JSON.stringify({ type: 'create-room' }));
    //createPeerConnection();
    setupLocalMedia();
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
        ws.send(JSON.stringify({ type: 'join', room: roomNumber }));
        //createPeerConnection();
        setupLocalMedia();
    }
});


function createPeerConnection() {
    // Set up the RTCPeerConnection configuration
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    peerConnection = new RTCPeerConnection(configuration);

    // Add local media tracks to the peer connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Set up event handlers for the peer connection
    peerConnection.onicecandidate = handleICECandidateEvent;
    peerConnection.ontrack = handleTrackEvent;
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
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  }

function handleICECandidateEvent(event) {
    if (event.candidate) {
        // Send the ICE candidate to the other peers via the signaling server
        const message = JSON.stringify({ type: 'ice-candidate', candidate: event.candidate });
        ws.send(message);
    }
}

function handleTrackEvent(event) {
    // Add the remote video stream to the UI
    const remoteVideoElement = document.createElement('video');
    remoteVideoElement.srcObject = event.streams[0];
    remoteVideoElement.autoplay = true;
    remoteVideos.appendChild(remoteVideoElement);
}

function handleSignalingData(data) {
    switch (data.type) {
        case 'new-user':
            createPeerConnection();
            sendOffer();
            break;
        case 'user-left':
            // Handle the case when a user leaves the room
            break;
        case 'offer':
            // Handle the offer received from another user
            handleOffer(data.offer);
            break;
        case 'answer':
            // Handle the answer received from another user
            handleAnswer(data.answer);
            break;
        case 'ice-candidate':
            // Handle ICE candidates received from another user
            handleICECandidate(data.candidate);
            break;
    }
}

function sendOffer() {
    peerConnection.createOffer()
        .then((offer) => {
            return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
            const message = JSON.stringify({ type: 'offer', offer: peerConnection.localDescription });
            ws.send(message);
        })
        .catch((error) => {
            console.error('Error creating and sending offer:', error);
        });
}

function handleOffer(offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            return peerConnection.createAnswer();
        })
        .then((answer) => {
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            const message = JSON.stringify({ type: 'answer', answer: peerConnection.localDescription });
            ws.send(message);
        })
        .catch((error) => {
            console.error('Error handling offer:', error);
        });
}

function handleAnswer(answer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch((error) => {
            console.error('Error handling answer:', error);
        });
}

function handleICECandidate(candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
            console.error('Error handling ICE candidate:', error);
        });
}
