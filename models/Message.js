const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({

    room: String,

    sender: String,

    text: String,

    file: String,

    createdAt: {

        type: Date,

        default: Date.now

    }

});

module.exports = mongoose.model(
    "Message",
    messageSchema
);