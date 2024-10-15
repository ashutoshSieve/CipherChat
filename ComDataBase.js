require("dotenv").config();
const mongoose=require("mongoose");
mongoose.connect(process.env.URL);

const ComSchema=mongoose.Schema({
    name:String,
    pass:String,
    posts:[
        {
            name:String,
            post:String
        }
    ]
});
const Community=mongoose.model("Community", ComSchema);
module.exports=Community;