import express from "express";
import mongoose from "mongoose";

const peopleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
     
},
 { timestamps: true }
)


const People = mongoose.model('User', peopleSchema);

export default People;