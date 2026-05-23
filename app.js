require("dotenv").config();



/* ================= IMPORTS ================= */

const express = require("express");

const http = require("http");

const mongoose = require("mongoose");

const path = require("path");

const bcrypt = require("bcrypt");

const session = require("express-session");

const MongoStore = require("connect-mongo").default;



/* ================= APP ================= */

const app = express();

const server = http.createServer(app);



/* ================= SOCKET.IO ================= */

const { Server } = require("socket.io");

const io = new Server(server);



/* ================= MODELS ================= */

const User = require("./models/User");

const Message = require("./models/Message");



/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URL)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log(err);

});



/* ================= VIEW ENGINE ================= */

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));



/* ================= MIDDLEWARE ================= */

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));



/* ================= SESSION ================= */

app.use(

    session({

        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({

            mongoUrl: process.env.MONGO_URL

        }),

        cookie: {

            maxAge: 1000 * 60 * 60 * 24

        }

    })

);



/* ================= LOGIN CHECK ================= */

function isLoggedIn(req, res, next){

    if(req.session.user){

        next();

    }

    else{

        res.redirect("/");

    }

}



/* =======================================================
   LOGIN PAGE
======================================================= */

app.get("/", (req, res) => {

    res.render("login");

});



app.get("/login", (req, res) => {

    res.render("login");

});



/* =======================================================
   REGISTER PAGE
======================================================= */

app.get("/register", (req, res) => {

    res.render("register");

});



/* =======================================================
   REGISTER USER
======================================================= */

app.post("/register", async (req, res) => {

    try{

        const { username, password } = req.body;



        const existingUser = await User.findOne({

            username

        });



        if(existingUser){

            return res.send("Username already exists");

        }



        const hashedPassword = await bcrypt.hash(

            password,

            10

        );



        const newUser = new User({

            username,

            password: hashedPassword

        });



        await newUser.save();



        res.redirect("/login");

    }

    catch(err){

        console.log(err);

        res.send("Register Error");

    }

});



/* =======================================================
   LOGIN USER
======================================================= */

app.post("/login", async (req, res) => {

    try{

        const { username, password } = req.body;



        const user = await User.findOne({

            username

        });



        if(!user){

            return res.send("User not found");

        }



        const valid = await bcrypt.compare(

            password,

            user.password

        );



        if(!valid){

            return res.send("Wrong Password");

        }



        req.session.user = username;



        res.redirect("/users");

    }

    catch(err){

        console.log(err);

        res.send("Login Error");

    }

});



/* =======================================================
   USERS PAGE
======================================================= */

app.get("/users", isLoggedIn, async (req, res) => {

    try{

        const users = await User.find({

            username: {

                $ne: req.session.user

            }

        });



        res.render("users", {

            currentUser: req.session.user,

            users

        });

    }

    catch(err){

        console.log(err);

        res.send("Users Page Error");

    }

});



/* =======================================================
   PRIVATE CHAT PAGE
======================================================= */

app.get("/chat/:friend", isLoggedIn, async (req, res) => {

    try{

        const currentUser = req.session.user;

        const friend = req.params.friend;



        const ROOM_ID = [currentUser, friend]

            .sort()

            .join("_");



        const messages = await Message.find({

            room: ROOM_ID

        });



        const formattedMessages = messages.map((msg) => {

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

            user: currentUser,

            friend,

            room: ROOM_ID,

            messages: formattedMessages

        });

    }

    catch(err){

        console.log(err);

        res.send("Chat Error");

    }

});



/* =======================================================
   LOGOUT
======================================================= */

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/");

    });

});



/* =======================================================
   SOCKET.IO
======================================================= */

io.on("connection", (socket) => {

    console.log("User Connected");



    socket.on("join room", (room) => {

        socket.join(room);

    });



    socket.on("chat message", async (data) => {

        try{

            const newMessage = new Message({

                room: data.room,

                sender: data.user,

                text: data.message

            });



            await newMessage.save();



            io.to(data.room).emit("chat message", {

                user: data.user,

                message: data.message,

                time: new Date().toLocaleTimeString([], {

                    hour: "2-digit",

                    minute: "2-digit"

                })

            });

        }

        catch(err){

            console.log(err);

        }

    });



    socket.on("disconnect", () => {

        console.log("User Disconnected");

    });

});



/* =======================================================
   SERVER
======================================================= */

const PORT = process.env.PORT || 3000;



server.listen(PORT, () => {

    console.log(`Server Running On Port ${PORT}`);

});