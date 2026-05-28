require("dotenv").config();

console.log("MONGO_URL:", process.env.MONGO_URL);
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);

require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URL)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log("MongoDB Error:", err);

});

const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

app.use(session({

    secret: process.env.SESSION_SECRET || "secret",

    resave: false,

    saveUninitialized: false

}));
const MongoStore = require("connect-mongo").default;
const multer = require("multer");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);



// ================= MODELS =================

const User = require("./models/User");
const Message = require("./models/Message");
const Request = require("./models/Request");



// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URI)

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

app.use(express.json());



// ================= STATIC UPLOADS =================

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "public/uploads")
    )
);



// ================= FILE UPLOAD =================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, "public/uploads");

    },

    filename: (req, file, cb) => {

        cb(

            null,

            Date.now() +

            "-" +

            file.originalname

        );

    }

});

const upload = multer({

    storage

});



// ================= SESSION STORE =================

const store = MongoStore.create({

    mongoUrl: process.env.MONGO_URI,

    crypto: {

        secret: process.env.SESSION_SECRET,

    },

    touchAfter: 24 * 3600,

});



// ================= SESSION =================

app.use(session({

    store: store,

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {

        expires:
        Date.now() +
        7 * 24 * 60 * 60 * 1000,

        maxAge:
        7 * 24 * 60 * 60 * 1000,

        httpOnly: true

    }

}));



// ================= LOGIN CHECK =================

function isLoggedIn(req, res, next){

    if(req.session.user){

        next();

    }

    else{

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



// ================= REGISTER PAGE =================

app.get("/register", (req, res) => {

    res.render("register");

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

        let approvedStatus = false;

        if(username === "umar"){

            approvedStatus = true;

        }

        const newUser = new User({

            username,

            password: hashedPassword,

            approved: approvedStatus

        });

        await newUser.save();

        if(username === "umar"){

            return res.redirect("/login");

        }

        res.render("pending");

    }

    catch(err){

        console.log(err);

        res.send("Registration Error");

    }

});



// ================= ADMIN PANEL =================

app.get("/admin",

    isLoggedIn,

    async (req, res) => {

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

                {

                    sender: req.params.username

                },

                {

                    receiver: req.params.username

                }

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

app.get("/users",

    isLoggedIn,

    async (req, res) => {

    try{

        const currentUser = req.session.user;

        const users = await User.find({

            username: {

                $ne: currentUser

            },

            approved: true

        });

        const requests = await Request.find({

            $or: [

                {

                    sender: currentUser

                },

                {

                    receiver: currentUser

                }

            ]

        });

        res.render("users", {

            users,

            currentUser,

            requests

        });

    }

    catch(err){

        console.log(err);

        res.send("Users Page Error");

    }

});



// ================= SEND REQUEST =================

app.post("/request/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        const sender = req.session.user;

        const receiver = req.params.username;



        if(sender === receiver){

            return res.redirect("/users");

        }



        const existingRequest =
        await Request.findOne({

            $or:[

                {

                    sender,
                    receiver,

                    status: {

                        $in: [

                            "pending",
                            "accepted"

                        ]

                    }

                },

                {

                    sender: receiver,

                    receiver: sender,

                    status: {

                        $in: [

                            "pending",
                            "accepted"

                        ]

                    }

                }

            ]

        });



        if(existingRequest){

            return res.redirect("/users");

        }



        await Request.create({

            sender,

            receiver,

            status: "pending"

        });



        res.redirect("/users");

    }

    catch(err){

        console.log(err);

        res.send("Request Error");

    }

});



// ================= REQUEST PAGE =================

app.get("/requests",

    isLoggedIn,

    async (req, res) => {

    try{

        const requests = await Request.find({

            receiver: req.session.user,

            status: "pending"

        });

        res.render("requests", {

            requests

        });

    }

    catch(err){

        console.log(err);

        res.send("Request Page Error");

    }

});



// ================= APPROVE REQUEST =================

app.post("/approve/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        await Request.findOneAndUpdate(

            {

                sender: req.params.username,

                receiver: req.session.user

            },

            {

                status: "accepted"

            }

        );

        res.redirect("/requests");

    }

    catch(err){

        console.log(err);

        res.send("Approve Error");

    }

});



// ================= DELETE REQUEST =================

app.post(

    "/delete-request/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        await Request.deleteMany({

            $or:[

                {

                    sender: req.params.username,

                    receiver: req.session.user

                },

                {

                    sender: req.session.user,

                    receiver: req.params.username

                }

            ]

        });

        res.redirect("/requests");

    }

    catch(err){

        console.log(err);

        res.send("Delete Error");

    }

});



// ================= CHAT PAGE =================

app.get("/chat/:username",

    isLoggedIn,

    async (req, res) => {

    try{

        const currentUser = req.session.user;

        const otherUser = req.params.username;

        const allowed = await Request.findOne({

            $or:[

                {

                    sender: currentUser,

                    receiver: otherUser,

                    status: "accepted"

                },

                {

                    sender: otherUser,

                    receiver: currentUser,

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

        })

        .sort({

            createdAt:1

        });



        const formattedMessages =
        messages.map((msg)=>{

            return{

                sender: msg.sender,

                text: msg.text,

                file: msg.file,

                time: new Date(

                    msg.createdAt

                )

                .toLocaleTimeString(

                    "en-IN",

                    {

                        timeZone:"Asia/Kolkata",

                        hour:"2-digit",

                        minute:"2-digit"

                    }

                )

            };

        });



        res.render("chat", {

            user: currentUser,

            chattingWith: otherUser,

            room,

            messages: formattedMessages

        });

    }

    catch(err){

        console.log(err);

        res.send("Chat Error");

    }

});



// ================= FILE UPLOAD =================

app.post(

    "/upload/:friend",

    isLoggedIn,

    upload.single("file"),

    async (req, res) => {

    try{

        const sender = req.session.user;

        const receiver = req.params.friend;

        const room = [

            sender,

            receiver

        ]

        .sort()

        .join("_");



        if(!req.file){

            return res.send(
                "No file uploaded"
            );

        }



        const filePath =
        "/uploads/" + req.file.filename;



        const newMessage = new Message({

            room,

            sender,

            text: "",

            file: filePath

        });



        await newMessage.save();



        res.redirect(

            "/chat/" + receiver

        );

    }

    catch(err){

        console.log(err);

        res.send("Upload Error");

    }

});



// ================= LOGOUT =================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/login");

    });

});



// ================= CHANGE PASSWORD PAGE =================

app.get("/change-password", (req, res) => {

    if (!req.session.user) {

        return res.redirect("/login");

    }

    res.render("change-password");

});



// ================= CHANGE PASSWORD =================

app.post("/change-password", async (req, res) => {

    if (!req.session.user) {

        return res.redirect("/login");

    }

    const {

        currentPassword,
        newPassword,
        confirmPassword

    } = req.body;



    if (newPassword !== confirmPassword) {

        return res.send("Passwords do not match");

    }



    const user = await User.findOne({

        username: req.session.user

    });



    const match = await bcrypt.compare(

        currentPassword,
        user.password

    );



    if (!match) {

        return res.send("Current password is incorrect");

    }



    const hashedPassword = await bcrypt.hash(

        newPassword,
        10

    );



    user.password = hashedPassword;

    await user.save();



    res.render("password-success");

});



// ================= SOCKET =================

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

                    .toLocaleTimeString(

                        "en-IN",

                        {

                            timeZone: "Asia/Kolkata",

                            hour: "2-digit",

                            minute: "2-digit"

                        }

                    )

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



// ================= ERROR =================

app.use((err, req, res, next) => {

    console.log(err);

    res.status(500).send(err.message);

});



// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on ${PORT}`);

});