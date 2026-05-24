const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({

    sender: String,

    receiver: String,

    status: {

        type: String,

        default: "pending"

    }

});

module.exports = mongoose.model(
    "Request",
    requestSchema
);