require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const CryptoJS = require("crypto-js");

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

function isLoggedIn(req, res, next){
    if(req.session.user){
        next();
    } else {
        res.redirect("/");
    }
}

app.get("/", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {

    console.log(req.body);

    const { username, password } = req.body;

    const user = await User.findOne({ username });

    console.log(user);

    if(!user){
        return res.send("User not found");
    }

    const valid = await bcrypt.compare(password, user.password);

    console.log(valid);

    if(!valid){
        return res.send("Wrong password");
    }

    req.session.user = username;

    console.log("LOGIN SUCCESS");

    res.redirect("/chat");
});

app.get("/chat", isLoggedIn, async (req, res) => {

    const messages = await Message.find();

    const decryptedMessages = messages.map(msg => {

        const bytes = CryptoJS.AES.decrypt(
            msg.text,
            process.env.CHAT_SECRET
        );

        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        return {
            sender: msg.sender,
            text: decryptedText
        };
    });

    res.render("chat", {
        user: req.session.user,
        messages: decryptedMessages
    });
});

io.on("connection", (socket) => {

    socket.on("chat message", async (data) => {

        const encrypted = CryptoJS.AES.encrypt(
            data.message,
            process.env.CHAT_SECRET
        ).toString();

        const newMessage = new Message({
            sender: data.user,
            text: encrypted
        });

        await newMessage.save();

        io.emit("chat message", data);
    });
});

server.listen(3000, () => {
    console.log("Server Running On Port 3000");
});