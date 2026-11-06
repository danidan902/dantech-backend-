import express from 'express';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    }
})

 const User = mongoose.model('DanTech', userSchema);

export default User;