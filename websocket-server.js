const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const archiver = require('archiver');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = new Map();

let nextUserId = 1; // Initialize the next available user ID
let imageUrl = 'whiteboard.jpeg'

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
        } else if (data.type === 'send-text') {
            handleTextMessage(ws, data);
        } else if (data.type === 'text2image-sent') {
            handleText2Image(ws, data);
        } else if (data.type === 'img2img-sent') {
            handleImg2Img(ws, data);
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
    //console.log(rooms);
    const room = [...rooms].find(([_, clients]) => clients.has(ws));

    if (room) {
        for (const client of room[1]) {
            //console.log(client, ws);
            //console.log(room[1]);
            if (client !== ws) {
                if (message.type === 'ice-candidate') {
                    console.log("Broadcast icecandidate");
                    message.userId = ws.userId;  // added (new)
                    sendTo(client, message);
                }
                else if (client.userId === message.userId) {
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


function handleText2Image(ws, data){

    console.log(data)
    const sent_room = ws.roomId;
    const sent_user = ws.userId;

    // Inform clients to disable their send buttons
    for (const client_ws of rooms.get(sent_room)) {
        sendTo(client_ws, { type: 'disable-send-button' });
    }

    // Activate conda environment and run
    const pythonProcess = spawn('conda', ['run', '-n', 'smartRTC', 'python', 'text_to_image.py', data.value, sent_room]);

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        // Update imageUrl with the last line received
        imageUrl = lines[lines.length - 3].trim();

        // Broadcast the image URL to other users in the room
        for (const client_ws of rooms.get(sent_room)) {
            sendTo(client_ws, { type: 'text2image-rcvd', fromUserId: sent_user, imageUrl });
        }

        
    });

    // Inform clients to enable their send buttons when the Python file is done running
    for (const client_ws of rooms.get(sent_room)) {
        sendTo(client_ws, { type: 'enable-send-button' });
    }

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error from Python script: ${data}`);
    });
}


function handleImg2Img(ws, data){

    console.log(data)
    const sent_room = ws.roomId;
    const sent_user = ws.userId;

    // Inform clients to disable their send buttons
    for (const client_ws of rooms.get(sent_room)) {
        sendTo(client_ws, { type: 'disable-send-button' });
    }

    // Activate conda environment and run
    const pythonProcess = spawn('conda', ['run', '-n', 'smartRTC', 'python', 'image_to_image.py', imageUrl, data.value]);

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        // Update imageUrl with the last line received
        imageUrl = lines[lines.length - 3 ].trim();

        // Broadcast the image URL to other users in the room
        for (const client_ws of rooms.get(sent_room)) {
            sendTo(client_ws, { type: 'img2img-rcvd', fromUserId: sent_user, imageUrl });
        }
    });

    // Inform clients to enable their send buttons when the Python file is done running
    for (const client_ws of rooms.get(sent_room)) {
        sendTo(client_ws, { type: 'enable-send-button' });
    }

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Error from Python script: ${data}`);
    });
}


function handleTextMessage(ws, data) {
    console.log("get the text msg from a client");
    console.log(data);
    const sent_room = ws.roomId;
    const sent_user = ws.userId;

    // broadcast to other users in the room
    for (const client_ws of rooms.get(sent_room)) {
        if (client_ws !== ws) {
            sendTo(client_ws, { type: 'get-text', fromUserId: sent_user, value: data.value });
        }
    }
}

function generateRoomId() {
    // Generate a random room ID or use a more structured method
    return Math.floor(1000 + Math.random() * 9000).toString();
}

const fs = require('fs');

function handleLeaveRoom(ws) {
    const room = ws.roomId;
    if (rooms.has(room)) {
        rooms.get(room).delete(ws);
        console.log(`Client left room ${room}`);

        // Notify other participants in the room
        for (const client of rooms.get(room)) {
            sendTo(client, { type: 'user-left', userId: ws.userId });
        }

        // If the room is empty, remove it
        if (rooms.get(room).size === 0) {
            rooms.delete(room);
            // Delete the directory "public/assets" when the room is deleted
            const assetsDirPath = path.join(__dirname, 'public', 'assets', room, 'images');
            deleteDirectory(assetsDirPath);
        }
    }

}

// Function to recursively delete a directory
function deleteDirectory(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        const files = fs.readdirSync(directoryPath);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                // Recursively delete subdirectories
                deleteDirectory(filePath);
            } else {
                // Delete files
                fs.unlinkSync(filePath);
            }
        }

        // Delete the empty directory
        fs.rmdirSync(directoryPath);
        console.log(`Directory deleted: ${directoryPath}`);
    }
}

function createPeerConnection(ws1, ws2) {
    // Create a peer connection between two users
    // You can implement the WebRTC peer connection code here
}

function sendTo(ws, message) {
    ws.send(JSON.stringify(message));
}


// Define a route to download the zipped directory
app.get('/assets/:roomId/images', (req, res) => {
    const roomId = req.params.roomId;
    console.log('Current roomId: ', roomId);
    const directoryPath = path.join(__dirname, `public/assets/${roomId}/images`);
    const zipFilePath = path.join(__dirname, `public/assets/${roomId}/images.zip`);

    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');

        // Set appropriate headers for the response
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=images.zip`);

        // Send the zip file to the client
        res.sendFile(zipFilePath, () => {
            // After the file has been sent, delete it
            fs.unlinkSync(zipFilePath);
            console.log('Zip file deleted:', zipFilePath);
        });
    });

    archive.pipe(output);
    archive.directory(directoryPath, false);
    archive.finalize();
});


server.listen(8080, () => {
    console.log('WebSocket server is running on port 8080');
});