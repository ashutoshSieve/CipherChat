require("dotenv").config();
const mongoose=require("mongoose");
mongoose.connect(process.env.URL);

const UserSchema=mongoose.Schema({
    name:String,
    email:String,
    password:String,
    google_id:String,
    HPost:String,
});

const User=mongoose.model("User",UserSchema);
module.exports=User;