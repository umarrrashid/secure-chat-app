require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const User = require("./models/User");
const Message = require("./models/Message");


mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL
    }),

    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

//auth check
function isLoggedIn(req, res, next){

    if(req.session.user){
        next();
    }
    else{
        res.redirect("/");
    }

}

//routes
app.get("/", (req, res) => {

    return res.render("login");

});

app.get("/login", (req, res) => {

    return res.render("login");

});

//login
app.post("/login", async (req, res) => {

    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if(!user){
        return res.send("User not found");
    }

    const valid = await bcrypt.compare(
        password,
        user.password
    );

    if(!valid){
        return res.send("Wrong password");
    }

    req.session.user = username;

    res.redirect("/chat");

});

//chat page
app.get("/chat", isLoggedIn, async (req, res) => {

    const messages = await Message.find();

    const encryptedMessages = messages.map(msg => {

        return {

            sender: msg.sender,

            text: msg.text,

            time: new Date(msg.createdAt)
            .toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })

        };

    });

    res.render("chat", {

        user: req.session.user,

        messages: encryptedMessages

    });

});

//logout
app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");

    });

});

//clear chat
app.post("/clear-chat", async (req, res) => {

    await Message.deleteMany({});

    res.redirect("/chat");

});

//socket.IO
io.on("connection", (socket) => {

    socket.on("chat message", async (data) => {

        const newMessage = new Message({

            sender: data.user,

            text: data.message

        });

        await newMessage.save();

        io.emit("chat message", data);

    });

});

//err handeler
app.use((err, req, res, next) => {

    console.log(err);

    res.status(500).send(err.message);

});

//server

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(`Server Running On Port ${PORT}`);

});