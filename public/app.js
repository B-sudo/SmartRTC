const serverURL = 'ws://localhost:8080';

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomNumberInput = document.getElementById("roomNumberInput");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let roomNumber;
let localStream;
let peerConnection;

const ws = new WebSocket(serverURL);

ws.addEventListener("open", () => {
    setupLocalMedia();
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
    //setupLocalMedia();
    createPeerConnection();
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
        createPeerConnection();
        //setupLocalMedia();
    }
    else {
        console.log(`No room number`);
    }
});


function createPeerConnection() {
    // Check if localStream is defined and has tracks
    if (localStream && localStream.getTracks) {
        // Set up the RTCPeerConnection configuration
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        peerConnection = new RTCPeerConnection(configuration);

        // Add local media tracks to the peer connection
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        // Set up event handlers for the peer connection
        peerConnection.onicecandidate = handleICECandidateEvent;
        peerConnection.ontrack = handleTrackEvent;
        console.log('Peer Connection Created');
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
    if (event.candidate) {
        // Send the ICE candidate to the other peers via the signaling server
        const message = JSON.stringify({ type: 'ice-candidate', candidate: event.candidate });
        ws.send(message);
    }
}

function handleTrackEvent(event) {
    // Add the remote video stream to the UI
    console.log('handleTrackEvent');
    const remoteVideoElement = document.createElement('video');
    remoteVideoElement.srcObject = event.streams[0];
    remoteVideoElement.autoplay = true;
    //remoteVideoElement.muted = true;
    //remoteVideoElement.playsinline = true;
    remoteVideoElement.setAttribute('playsinline', true);
    // Wait for the 'loadedmetadata' event to ensure video dimensions are available
    // Wait for the 'loadedmetadata' event to ensure video dimensions are available
    remoteVideoElement.addEventListener('loadedmetadata', () => {
        console.log('Video Dimensions:', remoteVideoElement.videoWidth, remoteVideoElement.videoHeight);

        // Check the readyState of the video stream
        if (event.streams[0].readyState !== undefined) {
            console.log('Video Stream State:', event.streams[0].readyState);
        } else {
            console.log('Video Stream State is undefined');
        }
    });

    //remoteVideo.appendChild(remoteVideoElement);
    remoteVideo.srcObject = event.streams[0];

    console.log('Video Tracks:', event.streams[0].getVideoTracks());

    console.log('Video Stream State:', event.streams[0].readyState);

    
    event.streams[0].getTracks().forEach(track => {
        console.log(`Track kind: ${track.kind}, id: ${track.id}, state: ${track.readyState}`);
    });
}

function handleSignalingData(data) {
    switch (data.type) {
        case 'new-user':
            //createPeerConnection();
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
            console.log('SendOffer');
        })
        .catch((error) => {
            console.error('Error creating and sending offer:', error);
        });
}

function handleOffer(offer) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            console.log('ICE Gathering State (before createAnswer):', peerConnection.iceGatheringState);
            return peerConnection.createAnswer();
        })
        .then((answer) => {
            console.log('ICE Gathering State (after createAnswer, before setLocalDescription):', peerConnection.iceGatheringState);
            return peerConnection.setLocalDescription(answer);
        })
        .then(() => {
            console.log('ICE Gathering State (after setLocalDescription):', peerConnection.iceGatheringState);
            // Check if ICE gathering is complete before sending the answer
            if (peerConnection.iceGatheringState === 'complete') {
                sendAnswer();
            } else {
                // Listen for the icegatheringstatechange event
                peerConnection.addEventListener('icegatheringstatechange', () => {
                    console.log('ICE Gathering State (change):', peerConnection.iceGatheringState);
                    if (peerConnection.iceGatheringState === 'complete') {
                        sendAnswer();
                    }
                });
            }
        })
        .catch((error) => {
            console.error('Error handling offer:', error);
        });

    function sendAnswer() {
        const message = JSON.stringify({ type: 'answer', answer: peerConnection.localDescription });
        ws.send(message);
        console.log('Offer Received, sending answers');
    }
}

function handleAnswer(answer) {
        console.log('signalstate');
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .catch((error) => {
            console.error('Error handling answer:', error);
        });
        console.log('ICE Gathering State:', peerConnection.iceGatheringState);

}

function handleICECandidate(candidate) {
    console.log('handleICECandidate');
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => {
            console.error('Error handling ICE candidate:', error);
        });
}
