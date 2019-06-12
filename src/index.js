const express = require('express')
const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')

const app = express()
const server = http.createServer(app)
const io = socketio(server)
const { generateMessage, generateLocationMessage } = require('./utils/message')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const port = process.env.PORT || 3200

const publicDirPath = path.join(__dirname, '../public')

app.use(express.static(publicDirPath))

server.listen(port, () => {
    console.log('chat app is running on port ' + port)
})

io.on('connection', (socket) => {    
    
    socket.on('join', ({ username, room }, callback) => {        
        const { error, user } = addUser({ id: socket.id, username, room })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        //emite para a conexão    
        socket.emit('message', generateMessage('admin', 'Welcome'))

        //emite para todo mundo menos quem conectou (na sala especifica)
        socket.broadcast.to(user.room).emit('message', generateMessage('admin', `${user.username} has joined`))
        console.log(user.room)
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {    
        const user = getUser(socket.id)

        if (user) {
            //emite para todo mundo
            const filter = new Filter()
            if (filter.isProfane(message)) {
                return callback('this message is not allowed')            
            }        

            io.to(user.room).emit('message', generateMessage(user.username, message))
            callback('')
        } else {
            callback('Undefined error')
        }
    })

    socket.on('sendLocation', (location, callback) => {    
        const user = getUser(socket.id)

        if (user) {
            io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${location.lat},${location.long}`))
            callback('Location shared')
        } else {
            callback('Undefined error')
        }        
    })    

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', generateMessage('admin', `${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }        
    })
})