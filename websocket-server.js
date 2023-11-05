const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'create-room') {
            const roomNumber = handleCreateRoom(ws);
            ws.send(JSON.stringify({ type: 'room-created', room: roomNumber }));
        } else if (data.type === 'join') {
            handleJoinRoom(ws, data.room);
        } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice') {
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
    rooms.set(roomId, new Set([ws]));
    ws.send(JSON.stringify({ type: 'room-created', room: roomId }));
    console.log(`Room created: ${roomId}`);
    return roomId;
}

function handleJoinRoom(ws, room) {
    if (rooms.has(room)) {
        rooms.get(room).add(ws);
        ws.roomId = room;
        console.log(`Client joined room ${room}`);

        // Notify the user about the other participants in the room
        for (const client of rooms.get(room)) {
            if (client !== ws) {
                sendTo(ws, { type: 'new-user' });
                sendTo(client, { type: 'new-user' });
                createPeerConnection(ws, client);
            }
        }
    } else {
        ws.send(JSON.stringify({ type: 'room-not-found' }));
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
