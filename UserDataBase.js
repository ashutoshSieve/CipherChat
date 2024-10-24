require("dotenv").config();
const mongoose=require("mongoose");
mongoose.connect(process.env.URL);
const UserSchema=mongoose.Schema({
    googleId:String,
    name:String,
    email:String,
    password:String,
    post:String
});

const User=mongoose.model("User",UserSchema);
module.exports=User;