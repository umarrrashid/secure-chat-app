require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

async function createUser() {

    // First User
    const hashedPassword1 = await bcrypt.hash("12345", 10);

    const user1 = new User({
        username: "umar",
        password: hashedPassword1
    });

    await user1.save();

    // Second User
    const hashedPassword2 = await bcrypt.hash("00000", 10);

    const user2 = new User({
        username: "user",
        password: hashedPassword2
    });

    await user2.save();

    console.log("Both Users Created");

    mongoose.connection.close();
}

createUser();