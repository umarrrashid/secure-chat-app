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

// ================= MODELS =================

const User = require("./models/User");
const Message = require("./models/Message");
const Request = require("./models/Request");

// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URL)
.then(() => {
    console.log("MongoDB Connected");
})
.catch((err) => {
    console.log(err);
});

// ================= VIEW ENGINE =================

app.set("view engine", "ejs");

app.set(
    "views",
    path.join(__dirname, "views")
);

// ================= MIDDLEWARE =================

app.use(express.static(
    path.join(__dirname, "public")
));

app.use(express.urlencoded({
    extended: true
}));

// ================= SESSION =================

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

// ================= LOGIN CHECK =================

function isLoggedIn(req, res, next){

    if(req.session.user){

        next();

    } else {

        res.redirect("/login");

    }

}

// ================= HOME =================

app.get("/", (req, res) => {

    res.redirect("/login");

});

// ================= LOGIN PAGE =================

app.get("/login", (req, res) => {

    res.render("login");

});

// ================= ADMIN LOGIN PAGE =================

app.get("/admin-login", (req, res) => {

    res.render("admin-login");

});

// ================= ADMIN LOGIN =================

app.post("/admin-login", async (req, res) => {

    try{

        const { username, password } = req.body;

        const admin = await User.findOne({
            username
        });

        if(!admin){

            return res.send("Admin not found");

        }

        const valid = await bcrypt.compare(
            password,
            admin.password
        );

        if(!valid){

            return res.send("Wrong password");

        }

        // ONLY UMAR IS ADMIN

        if(admin.username !== "umar"){

            return res.send("Access Denied");

        }

        req.session.user = admin.username;

        req.session.admin = true;

        res.redirect("/admin");

    }

    catch(err){

        console.log(err);

        res.send("Admin Login Error");

    }

});

// ================= USER LOGIN =================

app.post("/login", async (req, res) => {

    try{

        const { username, password } = req.body;

        const user = await User.findOne({
            username
        });

        if(!user){

            return res.send("User not found");

        }

        if(user.approved !== true){

            return res.send(
                "Waiting for admin approval"
            );

        }

        const valid = await bcrypt.compare(
            password,
            user.password
        );

        if(!valid){

            return res.send("Wrong password");

        }

        req.session.user = user.username;

        req.session.admin = false;

        res.redirect("/users");

    }

    catch(err){

        console.log(err);

        res.send("Login Error");

    }

});

// ================= REGISTER PAGE =================

app.get("/register", (req, res) => {

    res.render("register");

});

// ================= REGISTER USER =================

app.post("/register", async (req, res) => {

    try{

        const { username, password } = req.body;

        const existing = await User.findOne({
            username
        });

        if(existing){

            return res.send(
                "Username already exists"
            );

        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );

        const newUser = new User({

            username,

            password: hashedPassword,

            approved: false

        });

        await newUser.save();

        res.render("pending");

    }

    catch(err){

        console.log(err);

        res.send("Registration Error");

    }

});

// ================= ADMIN PANEL =================

app.get("/admin", isLoggedIn, async (req, res) => {

    if(!req.session.admin){

        return res.send("Access Denied");

    }

    const pendingUsers = await User.find({

        approved: false

    });

    res.render("admin", {

        pendingUsers

    });

});

// ================= APPROVE USER =================

app.get("/approve/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        if(!req.session.admin){

            return res.send("Access Denied");

        }

        await User.findOneAndUpdate(

            {

                username: req.params.username

            },

            {

                approved: true

            }

        );

        res.redirect("/admin");

    }

    catch(err){

        console.log(err);

        res.send("Approval Error");

    }

});

// ================= DELETE USER =================

app.get("/delete-user/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        if(!req.session.admin){

            return res.send("Access Denied");

        }

        await User.findOneAndDelete({

            username: req.params.username

        });

        await Request.deleteMany({

            $or: [

                { from: req.params.username },

                { to: req.params.username }

            ]

        });

        await Message.deleteMany({

            sender: req.params.username

        });

        res.redirect("/admin");

    }

    catch(err){

        console.log(err);

        res.send("Delete Error");

    }

});

// ================= USERS PAGE =================

app.get("/users", isLoggedIn, async (req, res) => {

    const currentUser = req.session.user;

    const users = await User.find({

        username: {

            $ne: currentUser

        },

        approved: true

    });

    const requests = await Request.find({

        $or: [

            { from: currentUser },

            { to: currentUser }

        ]

    });

    res.render("users", {

        users,

        currentUser,

        requests

    });

});

// ================= SEND REQUEST =================

app.get("/request/:username",

    isLoggedIn,

    async (req, res) => {

    const existing = await Request.findOne({

        $or: [

            {

                from: req.session.user,

                to: req.params.username

            },

            {

                from: req.params.username,

                to: req.session.user

            }

        ]

    });

    if(existing){

        return res.redirect("/users");

    }

    await Request.create({

        from: req.session.user,

        to: req.params.username,

        status: "pending"

    });

    res.redirect("/users");

});

// ================= REQUEST PAGE =================

app.get("/requests", isLoggedIn, async (req, res) => {

    const requests = await Request.find({

        to: req.session.user,

        status: "pending"

    });

    res.render("requests", {

        requests

    });

});

// ================= ACCEPT REQUEST =================

app.get("/accept/:id",

    isLoggedIn,

    async (req, res) => {

    await Request.findByIdAndUpdate(

        req.params.id,

        {

            status: "accepted"

        }

    );

    res.redirect("/requests");

});

// ================= DECLINE REQUEST =================

app.get("/decline/:id",

    isLoggedIn,

    async (req, res) => {

    await Request.findByIdAndDelete(

        req.params.id

    );

    res.redirect("/requests");

});

// ================= CHAT PAGE =================

app.get("/chat/:username",

    isLoggedIn,

    async (req, res) => {

    const currentUser = req.session.user;

    const otherUser = req.params.username;

    // CHECK PERMISSION

    const allowed = await Request.findOne({

        $or: [

            {

                from: currentUser,

                to: otherUser,

                status: "accepted"

            },

            {

                from: otherUser,

                to: currentUser,

                status: "accepted"

            }

        ]

    });

    if(!allowed){

        return res.send(
            "You are not allowed to chat"
        );

    }

    const room = [

        currentUser,

        otherUser

    ]

    .sort()

    .join("_");

    const messages = await Message.find({
        room
    });

    const formattedMessages = messages.map((msg) => {

        return {

            sender: msg.sender,

            text: msg.text,

            time: new Date(
                msg.createdAt
            ).toLocaleTimeString([], {

                hour: "2-digit",
                minute: "2-digit"

            })

        };

    });

    res.render("chat", {

        user: currentUser,

        room,

        messages: formattedMessages,

        chattingWith: otherUser

    });

});

// ================= LOGOUT =================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/login");

    });

});

// ================= SOCKET.IO =================

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

            io.to(data.room).emit(

                "chat message",

                {

                    user: data.user,

                    message: data.message,

                    time: new Date()

                    .toLocaleTimeString([], {

                        hour: "2-digit",

                        minute: "2-digit"

                    })

                }

            );

        }

        catch(err){

            console.log(err);

        }

    });

    socket.on("disconnect", () => {

        console.log("User Disconnected");

    });

});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {

    console.log(err);

    res.status(500).send(err.message);

});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Server Running On Port ${PORT}`
    );

});