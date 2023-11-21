const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();

let nextUserId = 1; // Initialize the next available user ID

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        
        const data = JSON.parse(message);
        console.log("A message of Type: ", data.type);
        if (data.type === 'create-room') {
            const roomNumber = handleCreateRoom(ws);
        } else if (data.type === 'join') {
            handleJoinRoom(ws, data.room);
        } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
            handleWebRTCMessage(ws, data);
        }
    });

    ws.on('close', () => {
        handleLeaveRoom(ws);
    });
});

function handleCreateRoom(ws) {
    const roomId = generateRoomId();
    ws.roomId = roomId;
    ws.userId = nextUserId++;
    rooms.set(roomId, new Set([ws]));
    ws.send(JSON.stringify({ type: 'room-created', room: roomId, userId: ws.userId }));
    console.log(`Room created: ${roomId}`);
    return roomId;
}

function handleJoinRoom(ws, room) {
    if (rooms.has(room)) {
        ws.userId = nextUserId++;
        ws.roomId = room;
        rooms.get(room).add( ws );
        ws.send(JSON.stringify({ type: 'room-joined', room: ws.roomId, userId: ws.userId }));
        console.log(`Client ${ws.userId} joined room ${room}`);

        // Notify the user about the other participants in the room
        for (const client_ws of rooms.get(room)) {
            if (client_ws !== ws) {
                console.log(client_ws);
                sendTo(ws, { type: 'new-user', userId: client_ws.userId });
                //sendTo(client.ws, { type: 'new-user', userId: ws.userId });
                createPeerConnection(ws, client_ws);
            }
        }
    } else {
        ws.send(JSON.stringify({ type: 'room-not-found' }));
        console.log(`room-not-found`);
    }
}

function handleWebRTCMessage(ws, message) {
    console.log(rooms);
    const room = [...rooms].find(([_, clients]) => clients.has(ws));
    if (message.type == 'ice-candidate') {
        console.log(" message ice");
    }
    if (room) {
        for (const client of room[1]) {
            console.log(client, ws);
            if (client !== ws) {
                if (message.type == 'ice-candidate') {
                    console.log("Broadcast icecandidate");
                    sendTo(client, message);
                }
                else if (client.userId == message.userId) {
                    // Broadcast the offer to the relevant recipient(s)
                    console.log('Transfer from ', ws.userId, " TO ", message.userId);
                    message.userId = ws.userId;
                    sendTo(client, message);
                }
            }
        }
    }
    else {
        console.log("No such room");
    }
}

function generateRoomId() {
    // Generate a random room ID or use a more structured method
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function handleLeaveRoom(ws) {
    const room = ws.roomId;
    if (rooms.has(room)) {
        rooms.get(room).delete(ws);
        console.log(`Client left room ${room}`);

        // Notify other participants in the room
        for (const client of rooms.get(room)) {
            sendTo(client, { type: 'user-left' });
        }

        // If the room is empty, remove it
        if (rooms.get(room).size === 0) {
            rooms.delete(room);
        }
    }
}

function createPeerConnection(ws1, ws2) {
    // Create a peer connection between two users
    // You can implement the WebRTC peer connection code here
}

function sendTo(ws, message) {
    ws.send(JSON.stringify(message));
}

server.listen(8080, () => {
    console.log('WebSocket server is running on port 8080');
});
