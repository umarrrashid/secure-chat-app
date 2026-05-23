const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./models/User");

mongoose.connect("mongodb://127.0.0.1:27017/securechat");

async function createUser(){

    const hashed = await bcrypt.hash("54321", 10)

    const user = new User({
        username: "saba",
        password: "umar@0177"
    });

    await user.save();

    console.log("User Created");

    mongoose.connection.close();
}

createUser();