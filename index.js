const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const userModel = require('./models/user');
const gmModel = require('./models/Groupchat');

const DB_CONNECTION_STRING =
"mongodb+srv://mustafaismailmab:mumu123@cluster0.kmefq4m.mongodb.net/comp3133_lab_test1?retryWrites=true&w=majority"
mongoose
  .connect(DB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Successfully connected to the MongoDB Atlas Server");
  })
  .catch((err) => {
    console.log(
      "Could not connect to the database. Exiting now...",
      err
    );
    process.exit();
  });

const socketio = require('socket.io');
const formatMessage = require('./models/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./models/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

const bot = "Bot";

io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    socket.emit('message', formatMessage(bot, 'Welcome to the Chat App!'));

    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(bot, `${user.username} has joined the chat`)
      );

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(bot, `${user.username} has left the chat`)
      );

      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

app.get('/signup', async (req, res) => {
  res.sendFile(__dirname + '/public/signup.html')
});

app.get('/login', async (req, res) => {
  res.sendFile(__dirname + '/public/login.html')
});
app.post('/login', async (req, res) => {
const user = new userModel(req.body);

try {
  await user.save((err) => {
    if(err){
        if (err.code === 11000) {
           return res.redirect('/signup?err=username')
        }
      
      res.send(err)
    }else{
      res.sendFile(__dirname + '/public/login.html')
    }
  });
} catch (err) {
  res.status(500).send(err);
}
});

app.get('/', async (req, res) => {
res.sendFile(__dirname + '/public/login.html')
});
app.post('/', async (req, res) => {
const username=req.body.username
const password=req.body.password

const user = await userModel.find({username:username});

try {
  if(user.length != 0){
    if(user[0].password==password){
      return res.redirect('/')
    }
    else{
      return res.redirect('/login?wrong=pass')
    }
  }else{
    return res.redirect('/login?wrong=uname')
  }
} catch (err) {
  res.status(500).send(err);
}
});


app.get('/chat/:room', async (req, res) => {
  const room = req.params.room
  const msg = await gmModel.find({room: room}).sort({'date_sent': 'desc'}).limit(10);
  if(msg.length!=0){
    res.send(msg)
  }
  else
  res.sendFile(__dirname + '/html/chat.html')
});
app.post('/chat',async(req,res)=>{
  const username=req.body.username
  const user = await userModel.find({username:username});
  console.log(user)
  if(user[0].username==username){
    return res.redirect('/chat/'+username)
  }
  else{
    return res.redirect('/?err=noUser')
  }
})

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


