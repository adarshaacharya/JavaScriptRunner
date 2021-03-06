import Axios from 'axios';
import mongoose from 'mongoose';
import socketIO from 'socket.io';
import Room from '../models/room.model';
import getExtension from '../utils/lang-to-extension';

const socketio = (server: any) => {
    const io = socketIO(server);

    // socket config
    io.on('connection', socket => {
        console.log('✅ Connected to room.');

        // create new room
        socket.on('create:room', async (body: { roomName: string; username: string }) => {
            try {
                const { roomName, username } = body;

                // create db room
                let room = new Room({
                    roomName,
                });

                const user = {
                    socketID: socket.id, // every socket(user) has unique id
                    username,
                };
                room.activeUsers.unshift(user);
                room = await room.save();

                //  create a room for sockets withn our game (socket room)
                const roomID = room._id.toString(); // create room id
                socket.join(roomID); // join socket(user) in that room ID -> socket(user) is in that room

                io.to(roomID).emit('update:room', room); // tell io server to send this to every server within room

                io.to(roomID).emit('update:message', {
                    text: `${username} created chat.`,
                    sender: username,
                    notification: true,
                }); // tell everyone in room that you created chat
            } catch (error) {
                console.log(error, 'Error in creating room');
            }
        });

        // join a new room
        socket.on('join:room', async (body, callback) => {
            try {
                const { roomID, username } = body;

                if (!mongoose.Types.ObjectId.isValid(roomID)) return callback({ msg: 'Room ID is not valid' });

                let room = await Room.findOne({ _id: roomID });
                if (!room) return callback({ msg: 'Room not found' }); // callback for error

                socket.join(roomID); // join the socket(user) in that room

                let user = {
                    socketID: socket.id,
                    username,
                };
                room.activeUsers.push(user);
                room = await room.save();

                io.to(roomID).emit('update:room', room);

                socket.emit('update:message', { text: `Welcome ${username}.`, notification: true });
                socket
                    .to(roomID)
                    .emit('update:message', { text: `${username} joined chat.`, notification: true, sender: username }); // tell everyone in room that you joined chat
            } catch (error) {
                console.log(error, 'Error in joining room');
            }
        });

        //code change
        socket.on('realtime:code', body => {
            try {
                const { value, roomID } = body;

                socket.broadcast.to(roomID).emit('update:code', value);
            } catch (error) {
                console.log(error);
            }
        });

        // language change
        socket.on('realtime:lang', body => {
            try {
                const { value, roomID } = body;
                socket.broadcast.to(roomID).emit('update:lang', value);
            } catch (error) {
                console.log(error);
            }
        });

        // input change
        socket.on('realtime:input', body => {
            try {
                const { value, roomID } = body;
                socket.broadcast.to(roomID).emit('update:input', value);
            } catch (error) {
                console.log(error);
            }
        });

        // submit code
        socket.on('realtime:run', async body => {
            try {
                const { userInput, sourceCode, language, roomID } = body;

                const extension = getExtension(language);
                const uri = `https://run.glot.io/languages/${language}/latest/`;

                const axiosConfig = {
                    headers: {
                        'user-agent': 'node.js',
                        Authorization: `Token ${process.env.GLOT_TOKEN}`,
                        'Content-type': 'application/json',
                    },
                };
                const data = {
                    stdin: userInput,
                    files: [
                        {
                            name: `main.${extension}`,
                            content: sourceCode,
                        },
                    ],
                };
                const output = await Axios.post(uri, data, axiosConfig);

                socket.broadcast.to(roomID).emit('update:output', output.data);
            } catch (error) {
                console.log(error.message);
            }
        });

        // message
        socket.on('realtime:message', async (body, callback) => {
            try {
                const { text, roomID, sender } = body;

                let room = await Room.findOne({
                    _id: roomID,
                });

                if (!room) return;
                const message = {
                    text,
                    sender,
                };
                room.messages.push(message);
                await room.save();

                io.to(roomID).emit('update:message', message);
                callback();
            } catch (error) {
                console.log(error);
            }
        });

        //loading
        socket.on('realtime:loading', (roomID: string) => {
            io.to(roomID).emit('update:loading', null);
        });

        // leave room
        socket.on('leave:room', async body => {
            const { username, roomID } = body;
            const socketID = socket.id.toString();

            await Room.updateOne({}, { $pull: { activeUsers: { socketID: socketID } } });

            io.to(roomID).emit('update:message', { text: `${username} has left room.`, notification: true });

            socket.leave(roomID);
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from room.');
        });
    });
};

export default socketio;
